const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CAD: 1.36,
  AUD: 1.53,
  CHF: 0.89,
  CNY: 7.24,
  INR: 83.1,
  MXN: 17.15,
  BRL: 4.97,
  SGD: 1.34,
  NZD: 1.63,
  HKD: 7.82,
  SEK: 10.42,
  NOK: 10.55,
  DKK: 6.88,
  ZAR: 18.63,
  AED: 3.67,
  THB: 35.1,
}

let cachedRates: Record<string, number> | null = null
let cacheTime = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

export async function getExchangeRates(base = 'USD'): Promise<Record<string, number>> {
  if (cachedRates && Date.now() - cacheTime < CACHE_TTL) {
    return cachedRates
  }

  const apiKey = process.env.EXCHANGE_RATE_API_KEY
  if (!apiKey) {
    return FALLBACK_RATES
  }

  try {
    const res = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    cachedRates = data.conversion_rates
    cacheTime = Date.now()
    return cachedRates!
  } catch {
    return FALLBACK_RATES
  }
}

export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return amount
  const fromRate = rates[from] || 1
  const toRate = rates[to] || 1
  return Math.round(((amount / fromRate) * toRate) * 100) / 100
}

export function getCurrencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$',
    AUD: 'A$', CHF: 'Fr', CNY: '¥', INR: '₹', MXN: '$',
    BRL: 'R$', SGD: 'S$', NZD: 'NZ$', HKD: 'HK$', SEK: 'kr',
    NOK: 'kr', DKK: 'kr', ZAR: 'R', AED: 'د.إ', THB: '฿',
  }
  return symbols[code] || code
}
