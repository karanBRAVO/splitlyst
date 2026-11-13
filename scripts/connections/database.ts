import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { type CheckResult, errorMessage, out } from './shared';

/**
 * Hide the password in a connection string before printing it. The password may itself contain an
 * "@" (the pg driver accepts that), so everything up to the LAST "@" is treated as the password.
 */
export function maskUrl(url: string): string {
  return url.replace(/^([a-z][a-z0-9+.-]*:\/\/[^:/@]*:)(.*)@([^@]*)$/i, '$1****@$3');
}

/** Connect, ping, and count the core tables so a missing schema is caught too. */
export async function checkDatabase(): Promise<CheckResult> {
  const name = 'Database';
  const url = process.env.DATABASE_URL;
  if (!url) {
    out.fail('DATABASE_URL is not set');
    return { name, status: 'fail', note: 'DATABASE_URL is not set' };
  }

  out.info(`URL: ${maskUrl(url)}`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: [] });
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1 AS ping`;
    out.ok(`Connected  (${Date.now() - start} ms)`);

    const [users, groups, expenses] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.expense.count(),
    ]);
    out.ok(`Tables reachable — users: ${users}, groups: ${groups}, expenses: ${expenses}`);
    return { name, status: 'ok' };
  } catch (err) {
    const message = errorMessage(err);
    out.fail(`Connection failed: ${message}`);
    return { name, status: 'fail', note: message };
  } finally {
    await prisma.$disconnect();
  }
}
