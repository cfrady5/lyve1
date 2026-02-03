// Tier types and configuration for LYVE pricing

export type Tier = 'free' | 'pro' | 'premium';

export interface TierLimits {
  maxSessions: number;
  canBulkEdit: boolean;
  canSort: boolean;
  canFilter: boolean;
  hasHistoricalAnalytics: boolean;
  hasPriceSuggestions: boolean;
  hasPerformanceDashboards: boolean;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    maxSessions: 3,
    canBulkEdit: false,
    canSort: false,
    canFilter: false,
    hasHistoricalAnalytics: false,
    hasPriceSuggestions: false,
    hasPerformanceDashboards: false,
  },
  pro: {
    maxSessions: Infinity,
    canBulkEdit: true,
    canSort: true,
    canFilter: true,
    hasHistoricalAnalytics: true,
    hasPriceSuggestions: false,
    hasPerformanceDashboards: false,
  },
  premium: {
    maxSessions: Infinity,
    canBulkEdit: true,
    canSort: true,
    canFilter: true,
    hasHistoricalAnalytics: true,
    hasPriceSuggestions: true,
    hasPerformanceDashboards: true,
  },
};

export const TIER_NAMES: Record<Tier, string> = {
  free: 'Clarity',
  pro: 'Control',
  premium: 'Advantage',
};

export const TIER_PRICES: Record<Tier, string> = {
  free: 'Free',
  pro: '$19/month',
  premium: '$49/month',
};

export function canAccessFeature(tier: Tier, feature: keyof TierLimits): boolean {
  return TIER_LIMITS[tier][feature] === true || TIER_LIMITS[tier][feature] === Infinity;
}

export function hasReachedLimit(tier: Tier, currentCount: number, limitType: keyof TierLimits): boolean {
  const limit = TIER_LIMITS[tier][limitType];
  if (typeof limit === 'number') {
    return currentCount >= limit;
  }
  return false;
}

export function getRequiredTier(feature: keyof TierLimits): Tier {
  if (TIER_LIMITS.premium[feature] && !TIER_LIMITS.pro[feature]) {
    return 'premium';
  }
  if (TIER_LIMITS.pro[feature] && !TIER_LIMITS.free[feature]) {
    return 'pro';
  }
  return 'free';
}

export function getTierHierarchy(tier: Tier): number {
  const hierarchy: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };
  return hierarchy[tier];
}

export function hasMinimumTier(userTier: Tier, requiredTier: Tier): boolean {
  return getTierHierarchy(userTier) >= getTierHierarchy(requiredTier);
}
