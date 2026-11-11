import { expect, test } from '@playwright/test';
import { PASSWORD, api, createUser, login, prisma, uniqueEmail } from './helpers';

test.describe('authentication & email verification', () => {
  test('register through the UI, then verify the email from the link', async ({ page }) => {
    const email = uniqueEmail('newbie');
    await page.goto('/register');
    await page.getByPlaceholder('Alex Johnson').fill('Newbie Tester');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Min. 8 characters').fill(PASSWORD);
    await page.getByPlaceholder('Repeat your password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Unverified banner is shown
    await expect(page.getByTestId('verify-banner')).toBeVisible();

    // Email isn't configured in the e2e server, so read the token the app stored
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const record = await prisma.emailVerificationToken.findFirstOrThrow({
      where: { userId: user.id },
    });
    await page.goto(`/api/auth/verify-email?token=${record.token}`);
    await expect(page).toHaveURL(/\/dashboard\?verified=1/);
    await expect(page.getByTestId('verify-banner')).toHaveCount(0);

    const after = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(after.emailVerified).not.toBeNull();
  });

  test('invalid verification links are rejected', async ({ page }) => {
    await page.goto('/api/auth/verify-email?token=nope');
    await expect(page).toHaveURL(/\/login\?verified=invalid/);
  });

  test('resend verification reports failure when email cannot be sent, and never leaks a link', async ({
    browser,
  }) => {
    const user = await createUser('Resend', { verified: false });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, user);
    await page.getByTestId('verify-banner').getByRole('button').click();
    // Email is disabled in the e2e server: the UI must say so rather than claim success
    await expect(page.getByText("We couldn't send the email right now")).toBeVisible();
    const res = await api<{ devUrl?: string }>(page, 'post', '/api/auth/verify-email');
    expect(res.status).toBe(502);
    expect(res.body.devUrl).toBeUndefined(); // links are never exposed in production
    await ctx.close();
  });

  test('wrong password shows an error and stays on login', async ({ page }) => {
    const user = await createUser('Wrongpw');
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Incorrect password')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('protected pages redirect to login', async ({ page }) => {
    await page.goto('/groups');
    await expect(page).toHaveURL(/\/login/);
  });

  test('password reset: no link leaks in production; token resets the password', async ({
    page,
  }) => {
    const user = await createUser('Resetter');
    const res = await api<Record<string, unknown>>(page, 'post', '/api/auth/forgot-password', {
      email: user.email,
    });
    expect(res.status).toBe(200);
    expect(res.body.resetUrl).toBeUndefined();

    const token = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    await page.goto(`/reset-password?token=${token.token}`);
    await page.getByPlaceholder('Min. 8 characters').fill('BrandNewPass1!');
    await page.getByPlaceholder('Repeat new password').fill('BrandNewPass1!');
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/login/);

    await login(page, { email: user.email, password: 'BrandNewPass1!' });
  });

  test('unknown emails get the same forgot-password response (no enumeration)', async ({
    page,
  }) => {
    const res = await api(page, 'post', '/api/auth/forgot-password', {
      email: 'nobody@e2e.test',
    });
    expect(res.status).toBe(200);
  });
});
