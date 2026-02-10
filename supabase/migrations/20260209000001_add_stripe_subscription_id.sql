-- Add stripe_subscription_id column for Stripe integration
-- The webhook handler needs this to store Stripe subscription IDs

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
