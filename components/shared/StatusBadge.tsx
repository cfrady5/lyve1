import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type SessionStatus = 'DRAFT' | 'FINALIZED' | 'RECONCILED';
type ItemStatus = 'ACTIVE' | 'SOLD' | 'ARCHIVED';
type Status = SessionStatus | ItemStatus;

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  // Session statuses
  DRAFT: {
    label: 'Draft',
    className: 'bg-warning-subtle text-warning-subtle border-warning-subtle'
  },
  FINALIZED: {
    label: 'Finalized',
    className: 'bg-info-subtle text-info-subtle border-info-subtle'
  },
  RECONCILED: {
    label: 'Reconciled',
    className: 'bg-success-subtle text-success-subtle border-success-subtle'
  },
  // Item statuses
  ACTIVE: {
    label: 'Active',
    className: 'bg-info-subtle text-info-subtle border-info-subtle'
  },
  SOLD: {
    label: 'Sold',
    className: 'bg-success-subtle text-success-subtle border-success-subtle'
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-muted text-muted-foreground border-border'
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {status}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
