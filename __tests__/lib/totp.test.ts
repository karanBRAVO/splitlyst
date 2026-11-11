import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  otpauthUrl,
  totpAt,
  verifyTotp,
} from '@/lib/totp';

// RFC 6238 appendix B test vectors use the ASCII secret "12345678901234567890" (SHA-1)
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp', () => {
  it('matches the RFC 6238 test vectors (last 6 digits)', () => {
    expect(totpAt(RFC_SECRET, 59_000)).toBe('287082');
    expect(totpAt(RFC_SECRET, 1_111_111_109_000)).toBe('081804');
    expect(totpAt(RFC_SECRET, 1_234_567_890_000)).toBe('005924');
  });

  it('round-trips base32', () => {
    const buf = Buffer.from('hello world, 1234');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    expect(() => base32Decode('not*base32')).toThrow();
  });

  it('verifies the current code and ±1 step, rejects others', () => {
    const secret = generateSecret();
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totpAt(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, totpAt(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpAt(secret, now + 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpAt(secret, now + 120_000), now)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', now)).toBe(false);
    expect(verifyTotp(secret, '12345', now)).toBe(false);
  });

  it('accepts codes typed with a space', () => {
    const secret = generateSecret();
    const now = 1_700_000_000_000;
    const code = totpAt(secret, now);
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(true);
  });

  it('builds an otpauth URL', () => {
    const url = otpauthUrl('ABC234', 'a@b.com');
    expect(url).toContain('otpauth://totp/Splitlyst%3Aa%40b.com');
    expect(url).toContain('secret=ABC234');
  });

  it('generates unique recovery codes whose hashes match', () => {
    const { plain, hashed } = generateRecoveryCodes(8);
    expect(new Set(plain).size).toBe(8);
    expect(plain[0]).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    expect(hashed[0]).toBe(hashRecoveryCode(plain[0].toUpperCase())); // case-insensitive
  });
});
