import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests run against a production build with deterministic FIXTURE
 * market data (no network, no keys). Run: npm run build && npm run e2e
 */
const PORT = 3200;
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    env: { MARKET_DATA_MODE: 'fixture' },
    timeout: 60_000,
  },
});
