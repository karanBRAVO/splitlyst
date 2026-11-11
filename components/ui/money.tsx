'use client';

import { formatCurrency } from '@/lib/utils';
import { useConvertToUserCurrency } from '@/lib/use-rates';
import { cn } from '@/lib/utils';

interface MoneyProps {
  amount: number;
  currency: string;
  className?: string;
  /** Show "≈ ₹x" in the user's preferred currency when the amount is in another currency */
  showConverted?: boolean;
}

/**
 * An amount in its own currency (always with the right symbol). When it differs from the viewer's
 * preferred currency, the converted value is shown next to it so figures stay comparable.
 */
export function Money({ amount, currency, className, showConverted = true }: MoneyProps) {
  const { userCurrency, convert } = useConvertToUserCurrency();
  const converted = showConverted && currency !== userCurrency ? convert(amount, currency) : null;

  return (
    <span className={className}>
      {formatCurrency(amount, currency)}
      {converted !== null && (
        <span
          className={cn('ml-1 text-xs font-normal text-gray-400')}
          title={`Converted to ${userCurrency}`}
        >
          ≈ {formatCurrency(converted, userCurrency)}
        </span>
      )}
    </span>
  );
}
