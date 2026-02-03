'use client';

import Link from 'next/link';
import { TIER_NAMES } from '@/lib/tiers';
import { Button } from '@/components/ui/button';

interface UpgradeBannerProps {
  message: string;
  tier: 'pro' | 'premium';
}

export function UpgradeBanner({ message, tier }: UpgradeBannerProps) {
  const tierName = TIER_NAMES[tier];

  return (
    <div className="mb-6 p-4 border border-primary/20 bg-primary/5 rounded-lg">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/billing">Upgrade to {tierName}</Link>
        </Button>
      </div>
    </div>
  );
}
