import { roundToTwoDecimals } from './utils';

export interface ParsedRow {
  date: string;
  description: string;
  category: string;
  cost: number;
  currency: string;
  /** member name -> net balance for this row (paid - share) */
  nets: Record<string, number>;
}

export interface ParsedCsv {
  members: string[];
  rows: ParsedRow[];
}

/** Minimal RFC-4180 style CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Parse a Splitwise "export as CSV" file. Throws on an unrecognised header. */
export function parseSplitwiseCsv(text: string): ParsedCsv {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error('The CSV file is empty');

  const header = table[0].map((h) => h.trim());
  const lower = header.map((h) => h.toLowerCase());
  const idx = {
    date: lower.indexOf('date'),
    description: lower.indexOf('description'),
    category: lower.indexOf('category'),
    cost: lower.indexOf('cost'),
    currency: lower.indexOf('currency'),
  };
  if (Object.values(idx).some((i) => i < 0)) {
    throw new Error(
      'Unrecognised CSV format: expected Date, Description, Category, Cost, Currency',
    );
  }
  const memberCols = header
    .map((name, i) => ({ name, i }))
    .filter(({ i }) => i > Math.max(...Object.values(idx)) && header[i] !== '');
  if (memberCols.length < 2) throw new Error('No member columns found in the CSV');

  const rows: ParsedRow[] = [];
  for (const r of table.slice(1)) {
    const date = (r[idx.date] ?? '').trim();
    const description = (r[idx.description] ?? '').trim();
    if (!date || /total balance/i.test(description)) continue; // summary rows
    const cost = parseFloat(r[idx.cost]);
    if (!isFinite(cost)) continue;

    const nets: Record<string, number> = {};
    for (const { name, i } of memberCols) {
      const v = parseFloat(r[i]);
      nets[name] = isFinite(v) ? v : 0;
    }
    rows.push({
      date,
      description,
      category: (r[idx.category] ?? '').trim(),
      cost,
      currency: (r[idx.currency] ?? 'USD').trim().toUpperCase() || 'USD',
      nets,
    });
  }
  return { members: memberCols.map((m) => m.name), rows };
}

/**
 * Parse the date formats Splitwise exports: ISO (2026-02-10) and US M/D/YY or M/D/YYYY (2/10/26).
 * Built explicitly (not via `new Date(string)`, whose parsing varies) and pinned to noon UTC so the
 * calendar day never shifts with the server's timezone. Returns null when it can't be read.
 */
export function parseImportDate(input: string): Date | null {
  const text = input.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text))) {
    [m, d] = [Number(match[1]), Number(match[2])];
    y = Number(match[3]);
    if (match[3].length === 2) y += y < 70 ? 2000 : 1900;
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const valid =
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return valid ? date : null;
}

export type PlannedItem =
  | {
      kind: 'expense';
      description: string;
      category: string;
      date: Date;
      amount: number;
      currency: string;
      paidBy: string;
      splits: Array<{ name: string; amount: number }>;
    }
  | {
      kind: 'payment';
      date: Date;
      amount: number;
      currency: string;
      payer: string;
      receiver: string;
    };

// Splitwise categories are free-form ("Transportation - Other", "Dining out", "TV/Phone/Internet"),
// so match on keywords instead of exact names. First match wins.
const CATEGORY_KEYWORDS: Array<[string[], string]> = [
  [['grocer'], 'groceries'],
  [['gift'], 'gifts'],
  [['dining', 'restaurant', 'food', 'drink', 'liquor', 'coffee'], 'food'],
  [['rent', 'mortgage', 'housing'], 'rent'],
  [['transport', 'taxi', 'fuel', 'parking', 'bicycle'], 'transport'],
  [['hotel', 'travel', 'flight', 'plane'], 'travel'],
  [['util', 'electric', 'heat', 'water', 'internet', 'phone', 'tv/', 'trash'], 'utilities'],
  [['entertain', 'movie', 'music', 'game'], 'entertainment'],
  [['cloth', 'shopping', 'electronics'], 'shopping'],
  [['medical', 'health', 'pharmac'], 'healthcare'],
  [['sport', 'fitness', 'gym'], 'sports'],
  [['educat', 'school'], 'education'],
];

export function mapCategory(name: string): string {
  const n = name.trim().toLowerCase();
  if (!n || n === 'general') return 'general';
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => n.includes(k))) return category;
  }
  return 'other';
}

/**
 * Turn parsed rows into expenses/payments. A row with exactly one member who is owed money is a
 * single-payer expense: share_m = paid_m - net_m, where only the payer paid (the full cost).
 * Rows with several payers are reported in `skipped` rather than guessed at.
 */
export function planImport(rows: ParsedRow[]): { items: PlannedItem[]; skipped: string[] } {
  const items: PlannedItem[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const date = parseImportDate(row.date);
    if (!date) {
      skipped.push(`${row.description}: invalid date "${row.date}"`);
      continue;
    }
    const entries = Object.entries(row.nets);
    const creditors = entries.filter(([, n]) => n > 0.005);
    if (creditors.length !== 1) {
      skipped.push(
        `${row.description}: ${creditors.length === 0 ? 'no payer found' : 'multiple payers are not supported'}`,
      );
      continue;
    }
    const [payer] = creditors[0];
    const debtors = entries.filter(([, n]) => n < -0.005);

    const isPayment =
      /^payment$/i.test(row.category) || /settle all balances/i.test(row.description);
    if (isPayment && debtors.length === 1) {
      items.push({
        kind: 'payment',
        date,
        amount: roundToTwoDecimals(Math.abs(debtors[0][1])),
        currency: row.currency,
        payer,
        receiver: debtors[0][0],
      });
      continue;
    }

    const splits = entries
      .map(([name, net]) => ({
        name,
        amount: roundToTwoDecimals((name === payer ? row.cost : 0) - net),
      }))
      .filter((s) => s.amount > 0.005);
    items.push({
      kind: 'expense',
      description: row.description || 'Imported expense',
      category: mapCategory(row.category),
      date,
      amount: roundToTwoDecimals(row.cost),
      currency: row.currency,
      paidBy: payer,
      splits,
    });
  }
  return { items, skipped };
}
