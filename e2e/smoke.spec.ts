import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // 404s for not-yet-built prefetch targets, and the Binance socket when the
    // test environment has no outbound network, are not app errors
    if (m.type() === 'error' && !/Failed to load resource|WebSocket connection/.test(m.text())) errors.push(m.text());
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

test('portfolio: optimizes, shows all portfolios, URL-driven assets', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/tools/portfolio?as=crypto:BTC,crypto:ETH,crypto:SOL,stock:SPY&nr=1000');
  await expect(page.getByRole('heading', { name: 'Portfolio', level: 1 })).toBeVisible();
  for (const k of ['minvar', 'maxsharpe', 'equal']) await expect(page.locator(`[data-metric="${k}"] dd`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/ALIGNED ON/)).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Controls' });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('button', { name: 'Remove SOL' }).click();
  await expect(page).toHaveURL(/as=crypto%3ABTC%2Ccrypto%3AETH%2Cstock%3ASPY|as=crypto:BTC,crypto:ETH,stock:SPY/);
  expect(errors).toEqual([]);
});

for (const path of ['/', '/tools/monte-carlo?n=500', '/tools/portfolio?nr=500', '/tools/backtest?lb=2']) {
  test(`no horizontal scroll: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(1500);
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw).toBeLessThanOrEqual(cw + 1);
  });
}

test('backtest: runs preset, sweep cell loads params into URL', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/tools/backtest?a=crypto:ETH&lb=3&gn=8&v=sweep');
  await expect(page.getByRole('heading', { name: 'Backtest', level: 1 })).toBeVisible();
  await expect(page.getByText('SIGNAL @ CLOSE(t) → FILL @ OPEN(t+1)', { exact: false }).first()).toBeAttached();
  await expect(page.getByRole('table', { name: 'Strategy and benchmark metrics' })).toBeVisible({ timeout: 30_000 });
  const cell = page.getByRole('gridcell', { name: /FAST MA 16, SLOW MA .*Sharpe [−-]?\d/ }).first();
  await expect(cell).toBeVisible({ timeout: 30_000 });
  await cell.click();
  await expect(page).toHaveURL(/p=f%3D16|p=f=16/);
  expect(errors).toEqual([]);
});

test('backtest: monthly-rebalanced portfolio from URL weights', async ({ page }) => {
  await page.goto('/tools/backtest?st=rebal&pw=crypto:BTC%3D0.5%3Bstock:SPY%3D0.5&lb=2');
  await expect(page.getByText(/MONTHLY REBALANCE/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('table', { name: 'Strategy and benchmark metrics' })).toBeVisible({ timeout: 30_000 });
});

test('accounts: login + dashboard show a clear not-configured state without Supabase keys', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();
  await expect(page.getByText('Accounts not configured')).toBeVisible();
  await page.goto('/dashboard');
  await expect(page.getByText('Accounts not configured')).toBeVisible();
  await page.goto('/tools/monte-carlo?n=500');
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(errors).toEqual([]);
});
