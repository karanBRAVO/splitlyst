import { expect, test } from '@playwright/test';

// The same shared button appears on both the login and the sign-up page
for (const path of ['/login', '/register']) {
  test.describe(`Continue with Google on ${path}`, () => {
    test('shows the Google logo in its brand colours, next to the label', async ({ page }) => {
      await page.goto(path);
      const button = page.getByTestId('google-signin');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Continue with Google');

      const logo = button.locator('svg');
      await expect(logo).toBeVisible();
      await expect(logo).toHaveAttribute('aria-hidden', 'true'); // decorative: the label is the name
      const svg = (await logo.evaluate((el) => el.outerHTML)).toLowerCase();
      for (const colour of ['#4285f4', '#34a853', '#fbbc05', '#ea4335'])
        expect(svg).toContain(colour);

      // sized sensibly and placed before the text
      const logoBox = (await logo.boundingBox())!;
      expect(logoBox.width).toBeGreaterThanOrEqual(16);
      expect(logoBox.width).toBeLessThanOrEqual(28);
      const buttonBox = (await button.boundingBox())!;
      expect(logoBox.x).toBeLessThan(buttonBox.x + buttonBox.width / 2);

      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    });

    test('sits below the form, after an "or" divider', async ({ page }) => {
      await page.goto(path);
      const form = page.locator('form').first();
      const formBox = (await form.boundingBox())!;
      const buttonBox = (await page.getByTestId('google-signin').boundingBox())!;
      expect(buttonBox.y).toBeGreaterThan(formBox.y + formBox.height - 1);
      await expect(page.getByText('or', { exact: true })).toBeVisible();
    });

    test("sends the user to Google with this app's client id and callback URL", async ({
      page,
    }) => {
      // Never contact the real Google: answer its address ourselves and inspect the request
      await page.route('https://accounts.google.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>fake google</h1>' }),
      );
      await page.goto(path);
      await page.getByTestId('google-signin').click();
      await page.waitForURL(/accounts\.google\.com/);

      const url = new URL(page.url());
      expect(url.hostname).toBe('accounts.google.com');
      expect(url.searchParams.get('client_id')).toBe('e2e-google-client-id');
      // this exact URL must be listed under "Authorized redirect URIs" in Google Cloud
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3100/api/auth/callback/google',
      );
      expect(url.searchParams.get('response_type')).toBe('code');
      const scope = url.searchParams.get('scope') ?? '';
      for (const s of ['openid', 'email', 'profile']) expect(scope).toContain(s);
      expect(url.searchParams.get('state')).toBeTruthy(); // CSRF protection is on
      expect(page.url()).not.toContain('e2e-google-client-secret'); // the secret never reaches the browser
    });
  });
}

test('after Google, the user lands where they were going (login honours ?callbackUrl, sign-up goes to the dashboard)', async ({
  browser,
}) => {
  const callbackCookie = async (path: string) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route('https://accounts.google.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: 'fake google' }),
    );
    await page.goto(path);
    await page.getByTestId('google-signin').click();
    await page.waitForURL(/accounts\.google\.com/);
    const cookie = (await context.cookies()).find((c) => c.name.includes('callback-url'));
    await context.close();
    return decodeURIComponent(cookie?.value ?? '');
  };

  expect(await callbackCookie('/login?callbackUrl=%2Fgroups')).toContain('/groups');
  expect(await callbackCookie('/login')).toContain('/dashboard');
  expect(await callbackCookie('/register')).toContain('/dashboard');
});
