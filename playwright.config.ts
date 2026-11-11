import { defineConfig, devices } from '@playwright/test';

try {
  process.loadEnvFile('.env');
} catch {
  // rely on the environment
}
// Never let a NODE_ENV from .env reach the test server: a production build must run as production
Reflect.deleteProperty(process.env, 'NODE_ENV');

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// The app runs as a production build so the tests exercise real production behaviour.
// Email is disabled (empty keys) so no real mail is sent; push uses the VAPID keys from .env.
export default defineConfig({
  testDir: './e2e',
  timeout: 150_000, // the test database is remote; a few hundred ms per query adds up
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: './e2e/.artifacts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/login`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'production',
      NEXTAUTH_URL: BASE_URL,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
      CRON_SECRET: 'e2e-cron-secret',
    },
  },
});
