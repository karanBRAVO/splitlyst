import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile('.env');
} catch {
  // .env not present — rely on environment variables already set (e.g. in CI/Vercel)
}

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
