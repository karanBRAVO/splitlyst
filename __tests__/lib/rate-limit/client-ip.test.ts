import { clientIp } from '@/lib/rate-limit';

describe('clientIp', () => {
  it('uses the first x-forwarded-for entry', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(clientIp({ headers: h })).toBe('1.2.3.4');
  });

  it('trims whitespace', () => {
    expect(clientIp({ headers: new Headers({ 'x-forwarded-for': '  9.9.9.9  , 1.1.1.1' }) })).toBe(
      '9.9.9.9',
    );
  });

  it('falls back to x-real-ip', () => {
    expect(clientIp({ headers: new Headers({ 'x-real-ip': '7.7.7.7' }) })).toBe('7.7.7.7');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '7.7.7.7' });
    expect(clientIp({ headers: h })).toBe('1.2.3.4');
  });

  it('falls back to unknown', () => {
    expect(clientIp({ headers: new Headers() })).toBe('unknown');
  });
});
