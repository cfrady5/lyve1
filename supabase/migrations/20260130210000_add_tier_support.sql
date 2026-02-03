-- Migration: Add tier support for Free/Pro/Premium pricing
-- This migration adds subscription tiers, usage tracking, and helper functions

-- 1. Add tier columns to profiles table
ALTER TABLE profiles
  ADD COLUMN tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'premium')),
  ADD COLUMN subscription_id TEXT,
  ADD COLUMN subscription_status TEXT CHECK (
    subscription_status IS NULL OR
    subscription_status IN ('active', 'canceled', 'past_due', 'trialing')
  ),
  ADD COLUMN subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN stripe_customer_id TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create usage tracking table
CREATE TABLE usage_limits (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  session_count INTEGER DEFAULT 0 NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Enable RLS on usage_limits
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for usage_limits
CREATE POLICY "Users can view own usage"
  ON usage_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON usage_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON usage_limits FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. Function to sync session count
CREATE OR REPLACE FUNCTION sync_session_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO usage_limits (user_id, session_count, last_updated)
    VALUES (NEW.user_id, 1, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      session_count = usage_limits.session_count + 1,
      last_updated = NOW();
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE usage_limits
    SET
      session_count = GREATEST(0, session_count - 1),
      last_updated = NOW()
    WHERE user_id = OLD.user_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 6. Triggers for session count tracking
CREATE TRIGGER on_session_created
  AFTER INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION sync_session_count();

CREATE TRIGGER on_session_deleted
  AFTER DELETE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION sync_session_count();

-- 7. Backfill existing users with usage data
INSERT INTO usage_limits (user_id, session_count, last_updated)
SELECT
  user_id,
  COUNT(*) as session_count,
  NOW()
FROM sessions
GROUP BY user_id
ON CONFLICT (user_id) DO NOTHING;

-- 8. Add indexes for performance
CREATE INDEX idx_profiles_tier ON profiles(tier);
CREATE INDEX idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX idx_usage_limits_user ON usage_limits(user_id);

-- 9. Function to check tier access
CREATE OR REPLACE FUNCTION check_tier_access(
  p_user_id UUID,
  p_required_tier TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_tier TEXT;
  v_tier_hierarchy JSONB;
BEGIN
  -- Define tier hierarchy
  v_tier_hierarchy := '{"free": 0, "pro": 1, "premium": 2}'::jsonb;

  -- Get user tier
  SELECT tier INTO v_user_tier
  FROM profiles
  WHERE id = p_user_id;

  -- Compare tiers
  RETURN (v_tier_hierarchy->>COALESCE(v_user_tier, 'free'))::int >=
         (v_tier_hierarchy->>p_required_tier)::int;
END;
$$;

-- 10. Function to check session limit
CREATE OR REPLACE FUNCTION check_session_limit(p_user_id UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  max_count INTEGER,
  tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_max_sessions INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Get user tier
  SELECT profiles.tier INTO v_tier
  FROM profiles
  WHERE id = p_user_id;

  v_tier := COALESCE(v_tier, 'free');

  -- Set max sessions based on tier
  v_max_sessions := CASE v_tier
    WHEN 'free' THEN 3
    ELSE 999999 -- Effectively unlimited for pro/premium
  END;

  -- Get current count
  SELECT COALESCE(session_count, 0) INTO v_current_count
  FROM usage_limits
  WHERE user_id = p_user_id;

  v_current_count := COALESCE(v_current_count, 0);

  RETURN QUERY SELECT
    v_current_count < v_max_sessions AS allowed,
    v_current_count AS current_count,
    v_max_sessions AS max_count,
    v_tier AS tier;
END;
$$;
