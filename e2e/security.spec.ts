import { expect, test } from '@playwright/test';
import { totpAt } from '../lib/totp';
import { PASSWORD, createUser, login, prisma } from './helpers';

test.describe('two-factor authentication', () => {
  test('enable 2FA, sign in with a code, then with a recovery code, then disable', async ({
    browser,
  }) => {
    const user = await createUser('Secure');
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, user);

    // --- enable ---
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Security' }).click();
    await page.getByRole('button', { name: 'Set up two-factor' }).click();
    const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
    await expect(page.getByAltText('2FA QR code')).toBeVisible();

    await page.getByTestId('totp-code').fill('000000');
    await page.getByRole('button', { name: 'Verify & enable' }).click();
    await expect(page.getByText('Invalid code')).toBeVisible();

    await page.getByTestId('totp-code').fill(totpAt(secret, Date.now()));
    await page.getByRole('button', { name: 'Verify & enable' }).click();
    await expect(page.getByTestId('recovery-codes')).toBeVisible();
    const codes = (await page.getByTestId('recovery-codes').locator('span').allTextContents()).map(
      (c) => c.trim(),
    );
    expect(codes).toHaveLength(8);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).totpEnabled).toBe(
      true,
    );
    await ctx.close();

    // --- sign in requires a code ---
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await p2.goto('/login');
    await p2.getByPlaceholder('you@example.com').fill(user.email);
    await p2.getByPlaceholder('••••••••').fill(PASSWORD);
    await p2.getByRole('button', { name: 'Sign in' }).click();
    await expect(p2.getByPlaceholder('123456 or a recovery code')).toBeVisible();
    await expect(p2).toHaveURL(/\/login/);

    await p2.getByPlaceholder('123456 or a recovery code').fill('111111');
    await p2.getByRole('button', { name: 'Sign in' }).click();
    await expect(p2.getByText('Invalid authentication code')).toBeVisible();

    await p2.getByPlaceholder('123456 or a recovery code').fill(totpAt(secret, Date.now()));
    await p2.getByRole('button', { name: 'Sign in' }).click();
    await expect(p2).toHaveURL(/\/dashboard/);
    await ctx2.close();

    // --- recovery code works once ---
    const ctx3 = await browser.newContext();
    const p3 = await ctx3.newPage();
    const useRecovery = async (page: typeof p3, code: string) => {
      await page.goto('/login');
      await page.getByPlaceholder('you@example.com').fill(user.email);
      await page.getByPlaceholder('••••••••').fill(PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.getByPlaceholder('123456 or a recovery code').fill(code);
      await page.getByRole('button', { name: 'Sign in' }).click();
    };
    await useRecovery(p3, codes[0]);
    await expect(p3).toHaveURL(/\/dashboard/);
    await ctx3.close();

    const ctx4 = await browser.newContext();
    const p4 = await ctx4.newPage();
    await useRecovery(p4, codes[0]); // already used
    await expect(p4.getByText('Invalid authentication code')).toBeVisible();

    // --- disable ---
    await useRecovery(p4, codes[1]);
    await expect(p4).toHaveURL(/\/dashboard/);
    await p4.goto('/settings');
    await p4.getByRole('button', { name: 'Security' }).click();
    await p4.getByPlaceholder('Password to disable').fill('wrong');
    await p4.getByRole('button', { name: 'Disable' }).click();
    await expect(p4.getByText('Password is incorrect').first()).toBeVisible();
    await p4.getByPlaceholder('Password to disable').fill(PASSWORD);
    await p4.getByRole('button', { name: 'Disable' }).click();
    await expect(p4.getByRole('button', { name: 'Set up two-factor' })).toBeVisible();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).totpEnabled).toBe(
      false,
    );
    await ctx4.close();
  });
});
