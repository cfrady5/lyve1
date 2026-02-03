'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { Tier } from '@/lib/tiers';
import { TIER_NAMES } from '@/lib/tiers';
import { Button } from '@/components/ui/button';

interface LockedFeatureProps {
  feature: string;
  requiredTier: Tier;
  inline?: boolean;
  description?: string;
}

export function LockedFeature({ feature, requiredTier, inline, description }: LockedFeatureProps) {
  const tierName = TIER_NAMES[requiredTier];

  if (inline) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-md text-sm text-muted-foreground">
        <Lock className="w-3 h-3" />
        <span>{tierName} feature</span>
      </div>
    );
  }

  return (
    <div className="p-6 border border-border rounded-lg bg-muted/20">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-full bg-muted">
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{feature}</h3>
          <p className="text-sm text-muted-foreground mb-3">
            {description || `Available with ${tierName}.`}
          </p>
          <Button size="sm" asChild>
            <Link href="/billing">Upgrade to {tierName}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
