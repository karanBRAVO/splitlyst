import { DICTIONARIES, LOCALES, isLocale, translate } from '@/lib/i18n';

describe('i18n', () => {
  it('translates known keys', () => {
    expect(translate('es', 'nav.groups')).toBe('Grupos');
    expect(translate('fr', 'nav.settings')).toBe('Paramètres');
  });
  it('falls back to English for unknown locale or missing key, then to the key', () => {
    expect(translate('xx', 'nav.groups')).toBe('Groups');
    expect(translate(undefined, 'nav.groups')).toBe('Groups');
    expect(translate('es', 'nope.key')).toBe('nope.key');
  });
  it('every locale defines every English key', () => {
    const englishKeys = Object.keys(DICTIONARIES.en);
    for (const { code } of LOCALES) {
      expect(isLocale(code)).toBe(true);
      expect(Object.keys(DICTIONARIES[code]).sort()).toEqual([...englishKeys].sort());
    }
  });
});
