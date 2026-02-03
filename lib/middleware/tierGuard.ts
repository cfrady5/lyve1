import { createClient } from '@/lib/supabase/server';
import type { Tier } from '@/lib/tiers';
import { getTierHierarchy } from '@/lib/tiers';

export async function requireTier(userId: string, requiredTier: Tier): Promise<boolean> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', userId)
    .single();

  const userTier = (profile?.tier as Tier) || 'free';
  return getTierHierarchy(userTier) >= getTierHierarchy(requiredTier);
}

export async function getUserTier(userId: string): Promise<Tier> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', userId)
    .single();

  return (profile?.tier as Tier) || 'free';
}

export async function checkSessionLimit(userId: string): Promise<{
  allowed: boolean;
  count: number;
  max: number;
  tier: Tier;
}> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', userId)
    .single();

  const tier = (profile?.tier as Tier) || 'free';
  const maxSessions = tier === 'free' ? 3 : 999999;

  const { data: usage } = await supabase
    .from('usage_limits')
    .select('session_count')
    .eq('user_id', userId)
    .single();

  const currentCount = usage?.session_count || 0;

  return {
    allowed: currentCount < maxSessions,
    count: currentCount,
    max: maxSessions,
    tier,
  };
}

export async function getSessionUsage(userId: string): Promise<{
  count: number;
  max: number;
}> {
  const limit = await checkSessionLimit(userId);
  return {
    count: limit.count,
    max: limit.max,
  };
}
