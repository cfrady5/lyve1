'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Tier } from '@/lib/tiers';

interface UseTierReturn {
  tier: Tier;
  loading: boolean;
  sessionCount: number;
  maxSessions: number;
  refresh: () => Promise<void>;
}

export function useTier(): UseTierReturn {
  const [tier, setTier] = useState<Tier>('free');
  const [loading, setLoading] = useState(true);
  const [sessionCount, setSessionCount] = useState(0);
  const [maxSessions, setMaxSessions] = useState(3);

  const fetchTier = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();

      const { data: usage } = await supabase
        .from('usage_limits')
        .select('session_count')
        .eq('user_id', user.id)
        .single();

      const userTier = (profile?.tier as Tier) || 'free';
      const count = usage?.session_count || 0;
      const max = userTier === 'free' ? 3 : 999999;

      setTier(userTier);
      setSessionCount(count);
      setMaxSessions(max);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTier();
  }, []);

  return { tier, loading, sessionCount, maxSessions, refresh: fetchTier };
}
