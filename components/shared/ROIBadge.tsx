import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ROIBadgeProps {
  roiPercent: number | null;
  className?: string;
  showLabel?: boolean;
}

export function ROIBadge({ roiPercent, className, showLabel = false }: ROIBadgeProps) {
  if (roiPercent === null || roiPercent === undefined) {
    return (
      <Badge variant="outline" className={cn('text-muted-foreground', className)}>
        —
      </Badge>
    );
  }

  const isProfit = roiPercent > 0;
  const isLoss = roiPercent < 0;

  const variantClass = isProfit
    ? 'bg-success-subtle text-success-subtle border-success-subtle'
    : isLoss
    ? 'bg-danger-subtle text-danger-subtle border-danger-subtle'
    : 'bg-muted text-muted-foreground border-border';

  const displayValue = `${roiPercent > 0 ? '+' : ''}${roiPercent.toFixed(1)}%`;

  return (
    <Badge
      variant="outline"
      className={cn(variantClass, 'font-mono', className)}
    >
      {showLabel && 'ROI: '}
      {displayValue}
    </Badge>
  );
}
