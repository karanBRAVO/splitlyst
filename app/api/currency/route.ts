import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRates, convertAmount } from '@/lib/currency';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') || 'USD';
  const to = searchParams.get('to') || 'USD';
  const amount = parseFloat(searchParams.get('amount') || '1');

  try {
    const rates = await getExchangeRates('USD');
    const converted = convertAmount(amount, from, to, rates);
    const rate = convertAmount(1, from, to, rates);

    return NextResponse.json({ from, to, amount, converted, rate, rates });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 500 });
  }
}
