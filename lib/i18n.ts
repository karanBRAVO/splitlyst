export const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'hi', label: 'हिन्दी' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];

type Dict = Record<string, string>;

const en: Dict = {
  'nav.dashboard': 'Dashboard',
  'nav.groups': 'Groups',
  'nav.friends': 'Friends',
  'nav.expenses': 'Expenses',
  'nav.payments': 'Payments',
  'nav.agent': 'AI Agent',
  'nav.activity': 'Activity',
  'nav.analytics': 'Analytics',
  'nav.settings': 'Settings',
  'nav.home': 'Home',
  'nav.add': 'Add',
  'nav.addExpense': 'Add expense',
  'nav.signOut': 'Sign out',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'verify.banner': 'Please verify your email address.',
  'verify.resend': 'Resend email',
};

export const DICTIONARIES: Record<Locale, Dict> = {
  en,
  es: {
    'nav.dashboard': 'Panel',
    'nav.groups': 'Grupos',
    'nav.friends': 'Amigos',
    'nav.expenses': 'Gastos',
    'nav.payments': 'Pagos',
    'nav.agent': 'Agente IA',
    'nav.activity': 'Actividad',
    'nav.analytics': 'Analíticas',
    'nav.settings': 'Ajustes',
    'nav.home': 'Inicio',
    'nav.add': 'Añadir',
    'nav.addExpense': 'Añadir gasto',
    'nav.signOut': 'Cerrar sesión',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'verify.banner': 'Por favor verifica tu correo electrónico.',
    'verify.resend': 'Reenviar correo',
  },
  fr: {
    'nav.dashboard': 'Tableau de bord',
    'nav.groups': 'Groupes',
    'nav.friends': 'Amis',
    'nav.expenses': 'Dépenses',
    'nav.payments': 'Paiements',
    'nav.agent': 'Agent IA',
    'nav.activity': 'Activité',
    'nav.analytics': 'Statistiques',
    'nav.settings': 'Paramètres',
    'nav.home': 'Accueil',
    'nav.add': 'Ajouter',
    'nav.addExpense': 'Ajouter une dépense',
    'nav.signOut': 'Se déconnecter',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'verify.banner': 'Veuillez vérifier votre adresse e-mail.',
    'verify.resend': "Renvoyer l'e-mail",
  },
  de: {
    'nav.dashboard': 'Übersicht',
    'nav.groups': 'Gruppen',
    'nav.friends': 'Freunde',
    'nav.expenses': 'Ausgaben',
    'nav.payments': 'Zahlungen',
    'nav.agent': 'KI-Agent',
    'nav.activity': 'Aktivität',
    'nav.analytics': 'Auswertung',
    'nav.settings': 'Einstellungen',
    'nav.home': 'Start',
    'nav.add': 'Neu',
    'nav.addExpense': 'Ausgabe hinzufügen',
    'nav.signOut': 'Abmelden',
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'verify.banner': 'Bitte bestätige deine E-Mail-Adresse.',
    'verify.resend': 'E-Mail erneut senden',
  },
  hi: {
    'nav.dashboard': 'डैशबोर्ड',
    'nav.groups': 'समूह',
    'nav.friends': 'दोस्त',
    'nav.expenses': 'खर्चे',
    'nav.payments': 'भुगतान',
    'nav.agent': 'एआई एजेंट',
    'nav.activity': 'गतिविधि',
    'nav.analytics': 'विश्लेषण',
    'nav.settings': 'सेटिंग्स',
    'nav.home': 'होम',
    'nav.add': 'जोड़ें',
    'nav.addExpense': 'खर्च जोड़ें',
    'nav.signOut': 'साइन आउट',
    'common.save': 'सहेजें',
    'common.cancel': 'रद्द करें',
    'verify.banner': 'कृपया अपना ईमेल सत्यापित करें।',
    'verify.resend': 'ईमेल दोबारा भेजें',
  },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.some((l) => l.code === value);
}

/** Translate a key; falls back to English, then to the key itself. */
export function translate(locale: string | undefined | null, key: string): string {
  const dict = DICTIONARIES[isLocale(locale) ? locale : 'en'];
  return dict[key] ?? en[key] ?? key;
}
