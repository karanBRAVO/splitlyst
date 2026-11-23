import { expect, test, type APIRequestContext } from '@playwright/test';
import { createUser } from './helpers';

test('registration is rate limited per IP', async ({ request }) => {
  let limited = 0;
  for (let i = 0; i < 14; i++) {
    const res = await request.post('/api/auth/register', {
      data: { name: 'x', email: 'not-an-email', password: 'short' }, // fails validation but counts
      headers: { 'x-forwarded-for': '203.0.113.77' },
    });
    if (res.status() === 429) {
      limited++;
      expect(res.headers()['retry-after']).toBeTruthy();
    }
  }
  expect(limited).toBeGreaterThan(0);
});

// ---- sign-in throttling (failed attempts are counted per account and per IP) ----

const LOCKED = /^Too many failed sign-in attempts\. Try again in \d+ minutes?\.$/;
const randomIp = () => `198.51.100.${1 + Math.floor(Math.random() * 250)}`;

/** Sign in through NextAuth's credentials endpoint. Returns the error message, or null on success. */
async function credentialsSignIn(
  request: APIRequestContext,
  creds: { email: string; password: string },
  ip: string,
): Promise<string | null> {
  const { csrfToken } = await (await request.get('/api/auth/csrf')).json();
  const res = await request.post('/api/auth/callback/credentials', {
    form: { csrfToken, email: creds.email, password: creds.password, json: 'true' },
    headers: { 'x-forwarded-for': ip },
  });
  const { url } = await res.json();
  return new URL(url).searchParams.get('error');
}

test('an account is locked after 10 wrong passwords, even for the right one', async ({
  request,
}) => {
  const user = await createUser('Locked');
  const ip = randomIp();
  const wrong = { email: user.email, password: 'not-the-password' };

  for (let i = 0; i < 10; i++) {
    expect(await credentialsSignIn(request, wrong, ip)).toBe('Incorrect password');
  }
  expect(await credentialsSignIn(request, wrong, ip)).toMatch(LOCKED);
  expect(await credentialsSignIn(request, user, ip)).toMatch(LOCKED);

  // other accounts, even from the same IP, are not affected
  const other = await createUser('Bystander');
  expect(await credentialsSignIn(request, other, ip)).toBeNull();
});

test('the lock is shown to the person on the login page', async ({ page }) => {
  const user = await createUser('LockedUi');
  await page.route('**/api/auth/callback/credentials', (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': randomIp() } }),
  );
  await page.goto('/login');
  for (let i = 0; i < 11; i++) {
    await page.getByPlaceholder('you@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').fill('wrong-password');
    const answered = page.waitForResponse((r) =>
      r.url().includes('/api/auth/callback/credentials'),
    );
    await page.getByRole('button', { name: 'Sign in' }).click();
    await answered; // earlier error toasts are still on screen, so wait for the response, not the text
  }
  await expect(page.getByText(/Too many failed sign-in attempts/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('a successful sign-in resets the failure count', async ({ request }) => {
  const user = await createUser('Reset');
  const ip = randomIp();
  const wrong = { email: user.email, password: 'nope' };

  for (let i = 0; i < 9; i++) await credentialsSignIn(request, wrong, ip);
  expect(await credentialsSignIn(request, user, ip)).toBeNull();
  for (let i = 0; i < 9; i++) {
    expect(await credentialsSignIn(request, wrong, ip)).toBe('Incorrect password');
  }
  expect(await credentialsSignIn(request, user, ip)).toBeNull();
});

test('an IP is blocked after 30 failures across different accounts', async ({ request }) => {
  const user = await createUser('Victim');
  const ip = randomIp();

  for (let i = 0; i < 30; i++) {
    const error = await credentialsSignIn(
      request,
      { email: `ghost${i}.${Date.now()}@e2e.test`, password: 'x' },
      ip,
    );
    expect(error).toBe('No account found with this email');
  }
  expect(await credentialsSignIn(request, user, ip)).toMatch(LOCKED);
  expect(await credentialsSignIn(request, user, randomIp())).toBeNull(); // another IP is fine
});
