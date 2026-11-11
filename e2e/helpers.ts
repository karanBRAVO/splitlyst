import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

try {
  process.loadEnvFile('.env');
} catch {
  // rely on the environment
}
Reflect.deleteProperty(process.env, 'NODE_ENV'); // .env may define it for `next dev`; the test runner shouldn't inherit it

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

export const PASSWORD = 'Passw0rd!e2e';
const RUN = Date.now().toString(36);

export const uniqueEmail = (name: string) =>
  `${name}.${RUN}.${Math.random().toString(36).slice(2, 6)}@e2e.test`;

/** Create a user straight in the DB (fast, and avoids the register rate limit). */
export async function createUser(name: string, opts: { verified?: boolean } = {}) {
  const email = uniqueEmail(name.toLowerCase());
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: await hash(PASSWORD, 4),
      emailVerified: opts.verified === false ? null : new Date(),
    },
  });
  return { id: user.id, name, email, password: PASSWORD };
}

export type TestUser = Awaited<ReturnType<typeof createUser>>;

export async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(user.email);
  await page.getByPlaceholder('••••••••').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Open a fresh browser context signed in as `user`. */
export async function sessionFor(
  browser: Browser,
  user: TestUser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, user);
  return { context, page };
}

export async function api<T = unknown>(
  page: Page,
  method: 'get' | 'post' | 'patch' | 'delete',
  url: string,
  data?: unknown,
): Promise<{ status: number; body: T }> {
  const res = await page.request[method](url, data === undefined ? {} : { data });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status(), body };
}

export async function getBalance(page: Page, groupId: string) {
  const { body } = await api<{ balances: Array<{ user: { name: string }; net: number }> }>(
    page,
    'get',
    `/api/balances?groupId=${groupId}`,
  );
  return Object.fromEntries(body.balances.map((b) => [b.user.name, b.net]));
}

export async function createGroup(page: Page, name: string, memberEmails: string[]) {
  await page.goto('/groups/new');
  await page.getByPlaceholder('e.g. Roommates, Trip to Paris').fill(name);
  for (const email of memberEmails) {
    await page.getByPlaceholder('friend@example.com').fill(email);
    await page.getByPlaceholder('friend@example.com').press('Enter');
  }
  await page.getByRole('button', { name: 'Create Group' }).click();
  await expect(page).toHaveURL(/\/groups\/(?!new)[a-z0-9]+$/);
  return page.url().split('/').pop()!;
}

export async function addEqualExpense(
  page: Page,
  groupId: string,
  description: string,
  amount: string,
) {
  await page.goto(`/expenses/new?groupId=${groupId}`);
  await page.getByPlaceholder('e.g. Dinner, Netflix, Rent...').fill(description);
  await page.locator('input[name="amount"]').fill(amount);
  await page.getByRole('button', { name: 'Add Expense' }).click();
  await expect(page).toHaveURL(new RegExp(`/groups/${groupId}`));
}
