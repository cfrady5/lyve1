'use client';

import type { Tier } from '@/lib/tiers';
import { getTierHierarchy } from '@/lib/tiers';
import { LockedFeature } from './LockedFeature';

interface FeatureGateProps {
  tier: Tier;
  requiredTier: Tier;
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  inline?: boolean;
}

export function FeatureGate({
  tier,
  requiredTier,
  feature,
  children,
  fallback,
  inline = false
}: FeatureGateProps) {
  if (getTierHierarchy(tier) >= getTierHierarchy(requiredTier)) {
    return <>{children}</>;
  }

  return fallback || <LockedFeature feature={feature} requiredTier={requiredTier} inline={inline} />;
}
