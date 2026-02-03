-- ================================================================
-- INVENTORY-CENTRIC MODEL MIGRATION
-- Lyvefolio as Single Source of Truth
-- ================================================================

-- ================================================================
-- 1. INVENTORY LIFECYCLE STATUS
-- Replace item_status with lifecycle-focused enum
-- ================================================================

-- Create new lifecycle status type
DO $$ BEGIN
  CREATE TYPE inventory_lifecycle_status AS ENUM ('active', 'sold', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add lifecycle status column
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lifecycle_status text DEFAULT 'active' 
  CHECK (lifecycle_status IN ('active', 'sold', 'archived'));

-- Add archived metadata
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS archived_reason text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS archived_notes text;

-- Add user_id directly to inventory_items for simpler queries
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add item name/display name if not exists
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS name text;

-- Add notes field
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS notes text;

-- Add updated_at timestamp
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Index for lifecycle status queries
CREATE INDEX IF NOT EXISTS idx_inventory_lifecycle_status ON inventory_items(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_archived_at ON inventory_items(archived_at);

-- ================================================================
-- 2. SESSION_ITEMS JOIN TABLE
-- Track which items were run in which session
-- ================================================================

CREATE TABLE IF NOT EXISTS session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  position integer,
  ran_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Each item can only be in a session once
  UNIQUE(session_id, item_id)
);

COMMENT ON TABLE session_items IS 'Join table tracking which items were run in which session';
COMMENT ON COLUMN session_items.position IS 'Order/position the item was shown in the stream';
COMMENT ON COLUMN session_items.ran_at IS 'When the item was actually shown/run in the stream';

CREATE INDEX IF NOT EXISTS idx_session_items_session ON session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_session_items_item ON session_items(item_id);
CREATE INDEX IF NOT EXISTS idx_session_items_position ON session_items(session_id, position);

-- Enable RLS
ALTER TABLE session_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for session_items
CREATE POLICY "Users can view session_items for their sessions"
  ON session_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_items.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert session_items for their sessions"
  ON session_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_items.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update session_items for their sessions"
  ON session_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_items.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete session_items for their sessions"
  ON session_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_items.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- ================================================================
-- 3. SALES TRANSACTIONS TABLE
-- Canonical transaction log for sold items
-- ================================================================

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  
  -- Platform info
  platform_id uuid REFERENCES platforms(id),
  platform_key text,
  
  -- Transaction details
  sold_price numeric(10,2) NOT NULL,
  fees numeric(10,2) NOT NULL DEFAULT 0,
  shipping_cost numeric(10,2) DEFAULT 0,
  taxes_collected numeric(10,2) DEFAULT 0,
  
  -- Computed fields (stored for performance)
  gross_revenue numeric(10,2) GENERATED ALWAYS AS (sold_price) STORED,
  total_deductions numeric(10,2) GENERATED ALWAYS AS (fees + COALESCE(shipping_cost, 0)) STORED,
  net_revenue numeric(10,2) GENERATED ALWAYS AS (sold_price - fees - COALESCE(shipping_cost, 0)) STORED,
  
  -- Sale metadata
  buyer_username text,
  order_id text,
  sold_at timestamptz NOT NULL DEFAULT now(),
  
  -- Notes
  notes text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sales IS 'Canonical transaction log for all sales';
COMMENT ON COLUMN sales.item_id IS 'Reference to the inventory item that was sold';
COMMENT ON COLUMN sales.session_id IS 'Session where item was sold (null if sold outside stream)';
COMMENT ON COLUMN sales.sold_price IS 'Final sale price';
COMMENT ON COLUMN sales.fees IS 'Total platform and processing fees';
COMMENT ON COLUMN sales.net_revenue IS 'Revenue after fees and shipping';

CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_item ON sales(item_id);
CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(session_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);
CREATE INDEX IF NOT EXISTS idx_sales_platform ON sales(platform_id);

-- Enable RLS
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales
CREATE POLICY "Users can view own sales"
  ON sales FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sales"
  ON sales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sales"
  ON sales FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sales"
  ON sales FOR DELETE
  USING (auth.uid() = user_id);

-- ================================================================
-- 4. BACKFILL USER_ID TO INVENTORY_ITEMS
-- ================================================================

UPDATE inventory_items 
SET user_id = sessions.user_id
FROM sessions
WHERE inventory_items.session_id = sessions.id
AND inventory_items.user_id IS NULL;

-- ================================================================
-- 5. BACKFILL SESSION_ITEMS FROM EXISTING DATA
-- Create session_items entries for all existing inventory items
-- ================================================================

INSERT INTO session_items (session_id, item_id, position, created_at)
SELECT 
  session_id,
  id as item_id,
  card_number as position,
  created_at
FROM inventory_items
WHERE session_id IS NOT NULL
ON CONFLICT (session_id, item_id) DO NOTHING;

-- ================================================================
-- 6. BACKFILL SALES FROM EXISTING SALE_ITEMS
-- Migrate existing sale data to the new sales table
-- ================================================================

INSERT INTO sales (
  user_id,
  item_id,
  session_id,
  platform_id,
  platform_key,
  sold_price,
  fees,
  shipping_cost,
  sold_at,
  created_at
)
SELECT 
  ii.user_id,
  ii.id as item_id,
  ii.session_id,
  si.platform_id,
  si.platform_key,
  si.sale_price as sold_price,
  si.fees,
  COALESCE(si.shipping_out, 0) + COALESCE(si.shipping_label_cost, 0) as shipping_cost,
  COALESCE(ii.sold_date::timestamptz, si.created_at) as sold_at,
  si.created_at
FROM inventory_items ii
JOIN sale_items si ON ii.sale_item_id = si.id
WHERE ii.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ================================================================
-- 7. UPDATE LIFECYCLE STATUS BASED ON EXISTING DATA
-- ================================================================

-- Mark items with sales as sold
UPDATE inventory_items 
SET lifecycle_status = 'sold'
WHERE sale_item_id IS NOT NULL;

-- Mark items with status 'sold' or 'shipped' as sold
UPDATE inventory_items 
SET lifecycle_status = 'sold'
WHERE item_status IN ('sold', 'shipped')
AND lifecycle_status != 'sold';

-- Items with 'hold' status become archived
UPDATE inventory_items 
SET lifecycle_status = 'archived',
    archived_reason = 'Converted from hold status'
WHERE item_status = 'hold'
AND lifecycle_status = 'active';

-- ================================================================
-- 8. FUNCTIONS FOR STATUS TRANSITIONS
-- ================================================================

-- Function: Mark item as sold
CREATE OR REPLACE FUNCTION mark_item_sold(
  p_item_id uuid,
  p_sold_price numeric,
  p_fees numeric DEFAULT 0,
  p_session_id uuid DEFAULT NULL,
  p_platform_id uuid DEFAULT NULL,
  p_platform_key text DEFAULT NULL,
  p_shipping_cost numeric DEFAULT 0,
  p_buyer_username text DEFAULT NULL,
  p_order_id text DEFAULT NULL,
  p_sold_at timestamptz DEFAULT now(),
  p_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_sale_id uuid;
BEGIN
  -- Get user_id from item
  SELECT user_id INTO v_user_id FROM inventory_items WHERE id = p_item_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Item not found or has no user_id';
  END IF;
  
  -- Create sale transaction
  INSERT INTO sales (
    user_id, item_id, session_id, platform_id, platform_key,
    sold_price, fees, shipping_cost, buyer_username, order_id, sold_at, notes
  ) VALUES (
    v_user_id, p_item_id, p_session_id, p_platform_id, p_platform_key,
    p_sold_price, p_fees, p_shipping_cost, p_buyer_username, p_order_id, p_sold_at, p_notes
  )
  RETURNING id INTO v_sale_id;
  
  -- Update item status
  UPDATE inventory_items 
  SET lifecycle_status = 'sold',
      sold_date = p_sold_at::date,
      updated_at = now()
  WHERE id = p_item_id;
  
  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_item_sold IS 'Create sale transaction and mark item as sold';

-- Function: Archive item
CREATE OR REPLACE FUNCTION archive_item(
  p_item_id uuid,
  p_reason text DEFAULT 'manual',
  p_notes text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_has_sale boolean;
BEGIN
  -- Check if item has been sold
  SELECT EXISTS(SELECT 1 FROM sales WHERE item_id = p_item_id) INTO v_has_sale;
  
  IF v_has_sale THEN
    RAISE EXCEPTION 'Cannot archive a sold item. Use sold status instead.';
  END IF;
  
  -- Archive the item
  UPDATE inventory_items 
  SET lifecycle_status = 'archived',
      archived_at = now(),
      archived_reason = p_reason,
      archived_notes = p_notes,
      updated_at = now()
  WHERE id = p_item_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION archive_item IS 'Archive an item (only if not sold)';

-- Function: Restore item to active
CREATE OR REPLACE FUNCTION restore_item_to_active(p_item_id uuid)
RETURNS boolean AS $$
DECLARE
  v_has_sale boolean;
BEGIN
  -- Check if item has been sold
  SELECT EXISTS(SELECT 1 FROM sales WHERE item_id = p_item_id) INTO v_has_sale;
  
  IF v_has_sale THEN
    RAISE EXCEPTION 'Cannot restore a sold item to active status.';
  END IF;
  
  -- Restore the item
  UPDATE inventory_items 
  SET lifecycle_status = 'active',
      archived_at = NULL,
      archived_reason = NULL,
      archived_notes = NULL,
      updated_at = now()
  WHERE id = p_item_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION restore_item_to_active IS 'Restore an archived item to active (only if no sale exists)';

-- ================================================================
-- 9. VIEWS FOR LYVEFOLIO
-- ================================================================

-- View: Active inventory items
CREATE OR REPLACE VIEW lyvefolio_active AS
SELECT 
  i.*,
  s.name as session_name,
  s.created_at as session_date,
  EXTRACT(DAY FROM (now() - COALESCE(i.acquisition_date::timestamptz, i.created_at))) as days_held
FROM inventory_items i
LEFT JOIN sessions s ON i.session_id = s.id
WHERE i.lifecycle_status = 'active';

-- View: Sold inventory items with profit calculations
CREATE OR REPLACE VIEW lyvefolio_sold AS
SELECT 
  i.id,
  i.user_id,
  i.session_id,
  i.card_number,
  i.display_name,
  i.name,
  i.image_url,
  i.cost_basis,
  i.acquisition_date,
  i.created_at as item_created_at,
  -- Sale details
  sl.id as sale_id,
  sl.sold_price,
  sl.fees,
  sl.shipping_cost,
  sl.net_revenue,
  sl.sold_at,
  sl.platform_id,
  sl.platform_key,
  sl.buyer_username,
  sl.order_id,
  -- Session info
  s.name as session_name,
  -- Profit calculations
  (sl.net_revenue - COALESCE(i.cost_basis, 0)) as net_profit,
  CASE 
    WHEN COALESCE(i.cost_basis, 0) > 0 
    THEN ROUND(((sl.net_revenue - COALESCE(i.cost_basis, 0)) / i.cost_basis * 100)::numeric, 2)
    ELSE 0 
  END as roi_percent,
  CASE 
    WHEN sl.sold_price > 0 
    THEN ROUND(((sl.net_revenue - COALESCE(i.cost_basis, 0)) / sl.sold_price * 100)::numeric, 2)
    ELSE 0 
  END as margin_percent,
  -- Platform info
  p.display_name as platform_name
FROM inventory_items i
JOIN sales sl ON sl.item_id = i.id
LEFT JOIN sessions s ON i.session_id = s.id
LEFT JOIN platforms p ON sl.platform_id = p.id
WHERE i.lifecycle_status = 'sold';

-- View: Archived inventory items
CREATE OR REPLACE VIEW lyvefolio_archived AS
SELECT 
  i.*,
  s.name as session_name,
  EXTRACT(DAY FROM (i.archived_at - COALESCE(i.acquisition_date::timestamptz, i.created_at))) as days_held_before_archive
FROM inventory_items i
LEFT JOIN sessions s ON i.session_id = s.id
WHERE i.lifecycle_status = 'archived';

-- View: Session items with status
CREATE OR REPLACE VIEW session_items_with_status AS
SELECT 
  si.*,
  i.lifecycle_status,
  i.display_name,
  i.name,
  i.cost_basis,
  i.image_url,
  i.card_number,
  s.name as session_name,
  -- Sale info if sold
  sl.sold_price,
  sl.fees,
  sl.net_revenue,
  sl.sold_at,
  (sl.net_revenue - COALESCE(i.cost_basis, 0)) as profit
FROM session_items si
JOIN inventory_items i ON si.item_id = i.id
JOIN sessions s ON si.session_id = s.id
LEFT JOIN sales sl ON sl.item_id = i.id AND sl.session_id = si.session_id;

-- ================================================================
-- 10. TRIGGERS FOR DATA INTEGRITY
-- ================================================================

-- Trigger: Update updated_at on inventory_items
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_inventory_updated_at ON inventory_items;
CREATE TRIGGER trigger_inventory_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();

-- Trigger: Update updated_at on sales
DROP TRIGGER IF EXISTS trigger_sales_updated_at ON sales;
CREATE TRIGGER trigger_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();

-- ================================================================
-- 11. GRANT PERMISSIONS ON VIEWS
-- ================================================================

GRANT SELECT ON lyvefolio_active TO authenticated;
GRANT SELECT ON lyvefolio_sold TO authenticated;
GRANT SELECT ON lyvefolio_archived TO authenticated;
GRANT SELECT ON session_items_with_status TO authenticated;
