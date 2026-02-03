import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ProfitDisplayProps {
  amount: number;
  showIcon?: boolean;
  showSign?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ProfitDisplay({
  amount,
  showIcon = false,
  showSign = true,
  className,
  size = 'md'
}: ProfitDisplayProps) {
  const isProfit = amount > 0;
  const isLoss = amount < 0;
  const isBreakEven = amount === 0;

  const sizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const colorClass = isProfit
    ? 'text-green-600'
    : isLoss
    ? 'text-red-600'
    : 'text-muted-foreground';

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: showSign ? 'exceptZero' : 'never'
  }).format(amount);

  return (
    <div className={cn('flex items-center gap-1 font-mono', sizeStyles[size], colorClass, className)}>
      {showIcon && (
        <>
          {isProfit && <TrendingUp className={iconSizes[size]} />}
          {isLoss && <TrendingDown className={iconSizes[size]} />}
          {isBreakEven && <Minus className={iconSizes[size]} />}
        </>
      )}
      <span>{formattedAmount}</span>
    </div>
  );
}
