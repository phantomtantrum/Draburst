import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // 404s for not-yet-visited prefetch targets are not app errors
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test('home renders, nav works, no console errors', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('quantphantom');
  await expect(page.getByText('Not investment advice.').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('monte carlo: runs, shows metrics, state lives in the URL, reproducible', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/tools/monte-carlo?n=2000&h=120&sd=12345');
  await expect(page.getByRole('heading', { name: 'Monte Carlo', level: 1 })).toBeVisible();
  await expect(page.getByText('[ ○ DEMO ADJ ]').or(page.getByText('DEMO')).first()).toBeVisible();
  const median = page.locator('[data-metric="med"] dd');
  await expect(median).toBeVisible({ timeout: 30_000 });
  const first = await median.textContent();

  // same URL → same result (seeded)
  await page.reload();
  await expect(median).toBeVisible({ timeout: 30_000 });
  expect(await median.textContent()).toBe(first);

  // change model → URL updates (controls live in a toggleable sheet on mobile)
  const toggle = page.getByRole('button', { name: 'Controls' });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('radio', { name: 'Bootstrap' }).click();
  await expect(page).toHaveURL(/m=boot/);
  await expect(page.getByText(/BOOTSTRAP · b=/)).toBeVisible({ timeout: 30_000 });

  // disclaimer visible on tool page
  await expect(page.getByText('Not investment advice.').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('monte carlo: methodology drawer opens and closes with Escape', async ({ page }) => {
  await page.goto('/tools/monte-carlo?n=500');
  await page.getByRole('button', { name: 'Methodology' }).first().click();
  const dlg = page.getByRole('dialog', { name: /Methodology/ });
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('.katex').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
});
