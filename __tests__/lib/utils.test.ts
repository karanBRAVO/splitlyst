import {
  formatCurrency,
  formatDate,
  formatDateRelative,
  getInitials,
  roundToTwoDecimals,
  parseCurrencyInput,
  getCategoryEmoji,
  getGroupCategoryEmoji,
} from '@/lib/utils';

describe('roundToTwoDecimals', () => {
  it('rounds correctly', () => {
    expect(roundToTwoDecimals(1.005)).toBe(1.01);
    expect(roundToTwoDecimals(1.004)).toBe(1);
    expect(roundToTwoDecimals(10 / 3)).toBe(3.33);
  });

  it('handles already-rounded values', () => {
    expect(roundToTwoDecimals(5.5)).toBe(5.5);
    expect(roundToTwoDecimals(100)).toBe(100);
  });
});

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(10.5, 'USD')).toBe('$10.50');
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('formats EUR correctly', () => {
    expect(formatCurrency(20, 'EUR')).toBe('€20.00');
  });

  it('uses absolute value (no minus sign from the formatter)', () => {
    expect(formatCurrency(-15, 'USD')).toBe('$15.00');
  });

  it('defaults to USD when currency is undefined', () => {
    expect(formatCurrency(5)).toBe('$5.00');
  });
});

describe('formatDate', () => {
  it('formats a Date object', () => {
    const d = new Date('2024-01-15T00:00:00Z');
    const result = formatDate(d);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2024/);
  });

  it('accepts a date string', () => {
    expect(() => formatDate('2024-06-01')).not.toThrow();
  });
});

describe('formatDateRelative', () => {
  it('returns "just now" for very recent times', () => {
    expect(formatDateRelative(new Date())).toBe('just now');
  });

  it('returns minutes ago', () => {
    const d = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatDateRelative(d)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatDateRelative(d)).toBe('3h ago');
  });

  it('returns "yesterday" for ~24h ago', () => {
    const d = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(formatDateRelative(d)).toBe('yesterday');
  });
});

describe('getInitials', () => {
  it('returns two capital letters', () => {
    expect(getInitials('Alice Bob')).toBe('AB');
  });

  it('handles single word', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('caps at 2 characters', () => {
    expect(getInitials('Alice Bob Carol')).toBe('AB');
  });
});

describe('parseCurrencyInput', () => {
  it('strips non-numeric characters', () => {
    expect(parseCurrencyInput('$1,234.56')).toBe(1234.56);
  });

  it('returns 0 for empty string', () => {
    expect(parseCurrencyInput('')).toBe(0);
  });

  it('returns 0 for non-numeric input', () => {
    expect(parseCurrencyInput('abc')).toBe(0);
  });
});

describe('getCategoryEmoji', () => {
  it('returns the correct emoji for known categories', () => {
    expect(getCategoryEmoji('food')).toBe('🍔');
    expect(getCategoryEmoji('transport')).toBe('🚗');
    expect(getCategoryEmoji('rent')).toBe('🏠');
  });

  it('falls back to a receipt emoji for unknown categories', () => {
    expect(getCategoryEmoji('unknown_xyz')).toBe('🧾');
  });
});

describe('getGroupCategoryEmoji', () => {
  it('returns correct emoji for known group categories', () => {
    expect(getGroupCategoryEmoji('trip')).toBe('✈️');
    expect(getGroupCategoryEmoji('home')).toBe('🏠');
  });

  it('falls back to a box emoji for unknown categories', () => {
    expect(getGroupCategoryEmoji('unknown_xyz')).toBe('📦');
  });
});
