-- ================================================================
-- FIX INVENTORY_ITEMS SCHEMA
-- Remove NOT NULL constraint from session_id since items are now
-- linked to sessions via the session_items join table
-- ================================================================

-- Make session_id nullable
ALTER TABLE inventory_items ALTER COLUMN session_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN inventory_items.session_id IS 'Legacy field - sessions are now linked via session_items table';

-- Ensure we have the right structure
ALTER TABLE inventory_items ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE inventory_items ALTER COLUMN cost_basis SET DEFAULT 0;

COMMENT ON TABLE inventory_items IS 'Master inventory - items can exist independently and be added to sessions via session_items';
