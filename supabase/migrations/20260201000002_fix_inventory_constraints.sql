-- ================================================================
-- FIX INVENTORY_ITEMS CONSTRAINTS
-- Make legacy fields nullable to support modern inventory workflow
-- ================================================================

-- Make card_number nullable (legacy field, not always applicable)
ALTER TABLE inventory_items ALTER COLUMN card_number DROP NOT NULL;

-- Set sensible defaults for numeric fields
ALTER TABLE inventory_items ALTER COLUMN card_number SET DEFAULT NULL;
ALTER TABLE inventory_items ALTER COLUMN cost_basis SET DEFAULT 0;

COMMENT ON COLUMN inventory_items.card_number IS 'Optional card number - not applicable for all inventory types';
