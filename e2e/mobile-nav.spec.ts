import { expect, test, type Browser, type Page } from '@playwright/test';
import { createUser, login } from './helpers';

const PHONE = { width: 390, height: 844 };

async function phoneSession(browser: Browser, name = 'Mobile') {
  const user = await createUser(name);
  const context = await browser.newContext({ viewport: PHONE });
  const page = await context.newPage();
  await login(page, user);
  return { context, page };
}

const openMore = async (page: Page) => {
  await page.getByTestId('more-button').click();
  await expect(page.getByTestId('more-sheet')).toBeVisible();
};

test.describe('mobile navigation', () => {
  test('the bottom bar has five slots and keeps the other pages out of sight until More is opened', async ({
    browser,
  }) => {
    const { context, page } = await phoneSession(browser);
    const bar = page.locator('nav.fixed');
    for (const label of ['Home', 'Groups', 'Add', 'Activity', 'More']) {
      await expect(bar.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByTestId('more-sheet')).toHaveCount(0);
    await context.close();
  });

  test('More lists every page the bar is missing, and each one is reachable', async ({
    browser,
  }) => {
    const { context, page } = await phoneSession(browser);
    const destinations: Array<[string, RegExp]> = [
      ['Friends', /\/friends$/],
      ['Expenses', /\/expenses$/],
      ['Payments', /\/payments$/],
      ['Analytics', /\/analytics$/],
      ['Settings', /\/settings$/],
    ];

    await openMore(page);
    const sheet = page.getByTestId('more-sheet');
    for (const [label] of destinations)
      await expect(sheet.getByRole('link', { name: label })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await page.keyboard.press('Escape');

    for (const [label, url] of destinations) {
      await openMore(page);
      await page.getByTestId('more-sheet').getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(url);
      // choosing a page closes the menu
      await expect(page.getByTestId('more-sheet')).toHaveCount(0);
    }
    await context.close();
  });

  test('More is highlighted on its own pages, and the current page is marked in the menu', async ({
    browser,
  }) => {
    const { context, page } = await phoneSession(browser);
    await page.goto('/dashboard');
    await expect(page.getByTestId('more-button')).toHaveAttribute('data-active', 'false');

    await page.goto('/friends');
    await expect(page.getByTestId('more-button')).toHaveAttribute('data-active', 'true');
    await openMore(page);
    await expect(
      page.getByTestId('more-sheet').getByRole('link', { name: 'Friends' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByTestId('more-sheet').getByRole('link', { name: 'Payments' }),
    ).not.toHaveAttribute('aria-current', 'page');
    await context.close();
  });

  test('"Add" (/expenses/new) is not mistaken for the Expenses list', async ({ browser }) => {
    const { context, page } = await phoneSession(browser);
    await page.goto('/expenses/new');
    await expect(page.getByTestId('more-button')).toHaveAttribute('data-active', 'false');
    await page.goto('/expenses');
    await expect(page.getByTestId('more-button')).toHaveAttribute('data-active', 'true');
    await context.close();
  });

  test('the menu closes with Escape and by tapping outside it', async ({ browser }) => {
    const { context, page } = await phoneSession(browser);
    await openMore(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('more-sheet')).toHaveCount(0);

    await openMore(page);
    await page.getByTestId('more-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('more-sheet')).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard/); // nothing was navigated
    await context.close();
  });

  test('the menu is announced as a dialog (accessibility)', async ({ browser }) => {
    const { context, page } = await phoneSession(browser);
    await expect(page.getByTestId('more-button')).toHaveAttribute('aria-expanded', 'false');
    await openMore(page);
    await expect(page.getByTestId('more-button')).toHaveAttribute('aria-expanded', 'true');
    const sheet = page.getByTestId('more-sheet');
    await expect(sheet).toHaveAttribute('role', 'dialog');
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await context.close();
  });

  test('signing out from the menu returns to the login page', async ({ browser }) => {
    const { context, page } = await phoneSession(browser);
    await openMore(page);
    await page.getByTestId('more-sheet').getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/); // really signed out
    await context.close();
  });

  test('the label follows the chosen language', async ({ browser }) => {
    const { context, page } = await phoneSession(browser);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Preferences' }).click();
    await page.getByTestId('locale').selectOption('es');
    await page.getByRole('button', { name: 'Save Preferences' }).click();
    await expect(page.getByText('Profile updated!')).toBeVisible();
    await expect(page.locator('nav.fixed').getByText('Más', { exact: true })).toBeVisible();
    await context.close();
  });

  test('on desktop there is no bottom bar; the sidebar already links to everything', async ({
    browser,
  }) => {
    const user = await createUser('Desktop');
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await login(page, user);
    await expect(page.getByTestId('more-button')).toBeHidden();
    const sidebar = page.locator('aside');
    for (const label of ['Friends', 'Expenses', 'Payments', 'Analytics', 'Settings']) {
      await expect(sidebar.getByRole('link', { name: label })).toBeVisible();
    }
    await context.close();
  });
});
