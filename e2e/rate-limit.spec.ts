import { expect, test } from '@playwright/test';

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
