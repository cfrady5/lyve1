-- ================================================================
-- LYVEFOLIO MASTER INVENTORY DATABASE
-- Single source of truth for all inventory items
-- ================================================================

-- ================================================================
-- 1. ENSURE ITEMS TABLE HAS ALL REQUIRED COLUMNS
-- ================================================================

-- Core item fields
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS acquired_at timestamptz DEFAULT now();
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS default_platform text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS notes text;

-- Card-specific optional fields
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS set_name text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS player text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS team text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS card_number_text text; -- e.g., "RC-25"
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS parallel text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS grader text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cert_number text;

-- Status field (simplified to match spec)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE' 
  CHECK (status IN ('ACTIVE', 'SOLD', 'ARCHIVED'));

-- Estimated value for future Lyve Value feature
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS estimated_value numeric(10,2);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS estimated_value_updated_at timestamptz;

-- Update existing lifecycle_status to status where needed
UPDATE inventory_items 
SET status = CASE 
  WHEN lifecycle_status = 'sold' THEN 'SOLD'
  WHEN lifecycle_status = 'archived' THEN 'ARCHIVED'
  ELSE 'ACTIVE'
END
WHERE status IS NULL AND lifecycle_status IS NOT NULL;

-- Ensure name has a fallback
UPDATE inventory_items
SET name = COALESCE(name, display_name, 'Item ' || card_number::text)
WHERE name IS NULL;

-- Copy image_url to photo_url if needed
UPDATE inventory_items
SET photo_url = image_url
WHERE photo_url IS NULL AND image_url IS NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_acquired_at ON inventory_items(acquired_at);
CREATE INDEX IF NOT EXISTS idx_inventory_name_search ON inventory_items USING gin(to_tsvector('english', COALESCE(name, '')));

-- ================================================================
-- 2. SALES TABLE (if not exists from previous migration)
-- ================================================================

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  
  -- Channel/Platform
  channel text NOT NULL DEFAULT 'other' CHECK (channel IN ('whatnot', 'ebay', 'instagram', 'in_person', 'other')),
  platform_id uuid REFERENCES platforms(id),
  
  -- Transaction details
  sold_price numeric(10,2) NOT NULL,
  fees numeric(10,2) NOT NULL DEFAULT 0,
  taxes numeric(10,2) NOT NULL DEFAULT 0,
  shipping numeric(10,2) DEFAULT 0,
  
  -- Computed net_profit (sold_price - fees - taxes - shipping - cost_basis)
  -- Note: cost_basis comes from items table
  
  -- Metadata
  buyer_username text,
  order_id text,
  sold_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add channel column if table exists but column doesn't
ALTER TABLE sales ADD COLUMN IF NOT EXISTS channel text DEFAULT 'other';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS taxes numeric(10,2) DEFAULT 0;

-- RLS for sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own sales' AND tablename = 'sales') THEN
    CREATE POLICY "Users can view own sales" ON sales FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own sales' AND tablename = 'sales') THEN
    CREATE POLICY "Users can insert own sales" ON sales FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own sales' AND tablename = 'sales') THEN
    CREATE POLICY "Users can update own sales" ON sales FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own sales' AND tablename = 'sales') THEN
    CREATE POLICY "Users can delete own sales" ON sales FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_item ON sales(item_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_channel ON sales(channel);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);

-- ================================================================
-- 3. SESSION_ITEMS JOIN TABLE (for many-to-many)
-- ================================================================

CREATE TABLE IF NOT EXISTS session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  item_number integer, -- the "Item #" during the stream
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(session_id, item_id)
);

ALTER TABLE session_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view session_items' AND tablename = 'session_items') THEN
    CREATE POLICY "Users can view session_items" ON session_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_items.session_id AND sessions.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert session_items' AND tablename = 'session_items') THEN
    CREATE POLICY "Users can insert session_items" ON session_items FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_items.session_id AND sessions.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update session_items' AND tablename = 'session_items') THEN
    CREATE POLICY "Users can update session_items" ON session_items FOR UPDATE
    USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_items.session_id AND sessions.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete session_items' AND tablename = 'session_items') THEN
    CREATE POLICY "Users can delete session_items" ON session_items FOR DELETE
    USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_items.session_id AND sessions.user_id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_items_session ON session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_session_items_item ON session_items(item_id);

-- ================================================================
-- 4. BACKFILL: Create session_items from existing inventory_items
-- ================================================================
-- MOVED TO: 20260130240000_sessions_livestream_workflow.sql
-- (Must run after item_number column is added to session_items)

-- INSERT INTO session_items (session_id, item_id, item_number, created_at)
-- SELECT
--   session_id,
--   id as item_id,
--   card_number as item_number,
--   created_at
-- FROM inventory_items
-- WHERE session_id IS NOT NULL
-- ON CONFLICT (session_id, item_id) DO NOTHING;

-- ================================================================
-- 5. BACKFILL: Create sales from existing sale_items linkages
-- ================================================================

INSERT INTO sales (
  user_id,
  item_id,
  session_id,
  platform_id,
  platform_key,
  sold_price,
  fees,
  taxes_collected,
  shipping_cost,
  sold_at,
  created_at
)
SELECT
  ii.user_id,
  ii.id as item_id,
  ii.session_id,
  si.platform_id,
  COALESCE(si.platform_key, 'other') as platform_key,
  si.sale_price as sold_price,
  COALESCE(si.fees, 0) as fees,
  COALESCE(si.taxes_collected, 0) as taxes_collected,
  COALESCE(si.shipping_out, 0) + COALESCE(si.shipping_label_cost, 0) as shipping_cost,
  COALESCE(ii.sold_date::timestamptz, si.created_at, now()) as sold_at,
  si.created_at
FROM inventory_items ii
JOIN sale_items si ON ii.sale_item_id = si.id
WHERE ii.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sales WHERE sales.item_id = ii.id)
ON CONFLICT DO NOTHING;

-- Update status for items with sales
UPDATE inventory_items 
SET status = 'SOLD'
WHERE id IN (SELECT item_id FROM sales)
AND status != 'SOLD';

-- ================================================================
-- 6. FUNCTION: Create sale and mark item sold
-- ================================================================

CREATE OR REPLACE FUNCTION create_sale_and_mark_sold(
  p_item_id uuid,
  p_platform_key text DEFAULT NULL,
  p_sold_price numeric DEFAULT 0,
  p_fees numeric DEFAULT 0,
  p_taxes_collected numeric DEFAULT 0,
  p_shipping_cost numeric DEFAULT 0,
  p_session_id uuid DEFAULT NULL,
  p_platform_id uuid DEFAULT NULL,
  p_buyer_username text DEFAULT NULL,
  p_order_id text DEFAULT NULL,
  p_sold_at timestamptz DEFAULT now(),
  p_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_sale_id uuid;
  v_current_status text;
BEGIN
  -- Get user_id and current status from item
  SELECT user_id, status INTO v_user_id, v_current_status
  FROM inventory_items WHERE id = p_item_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Item not found or has no user_id';
  END IF;

  IF v_current_status = 'SOLD' THEN
    RAISE EXCEPTION 'Item is already sold';
  END IF;

  -- Create sale transaction
  INSERT INTO sales (
    user_id, item_id, session_id, platform_id, platform_key,
    sold_price, fees, taxes_collected, shipping_cost, buyer_username, order_id, sold_at, notes
  ) VALUES (
    v_user_id, p_item_id, p_session_id, p_platform_id, p_platform_key,
    p_sold_price, p_fees, p_taxes_collected, p_shipping_cost, p_buyer_username, p_order_id, p_sold_at, p_notes
  )
  RETURNING id INTO v_sale_id;
  
  -- Update item status to SOLD
  UPDATE inventory_items 
  SET status = 'SOLD',
      sold_date = p_sold_at::date,
      updated_at = now()
  WHERE id = p_item_id;
  
  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 7. VIEW: Lyvefolio Active Items with KPIs
-- ================================================================

CREATE OR REPLACE VIEW lyvefolio_items_active AS
SELECT 
  i.id,
  i.user_id,
  i.name,
  i.photo_url,
  COALESCE(i.image_url, i.photo_url) as image,
  i.cost_basis,
  i.acquired_at,
  i.created_at,
  i.status,
  i.notes,
  -- Optional card details
  i.set_name,
  i.year,
  i.player,
  i.grade,
  i.grader,
  -- Session linkage indicator
  CASE WHEN EXISTS (
    SELECT 1 FROM session_items si WHERE si.item_id = i.id
  ) THEN true ELSE false END as in_session,
  -- Estimated value
  i.estimated_value
FROM inventory_items i
WHERE i.status = 'ACTIVE';

GRANT SELECT ON lyvefolio_items_active TO authenticated;

-- ================================================================
-- 8. VIEW: Lyvefolio Sold Items with Profit Calculations
-- ================================================================

CREATE OR REPLACE VIEW lyvefolio_items_sold AS
SELECT 
  i.id,
  i.user_id,
  i.name,
  COALESCE(i.image_url, i.photo_url) as image,
  i.cost_basis,
  i.acquired_at,
  -- Sale details
  s.id as sale_id,
  s.sold_price,
  s.fees,
  s.taxes_collected,
  s.shipping_cost,
  s.sold_at,
  s.platform_key,
  s.session_id,
  sess.name as session_name,
  -- Profit calculations
  (s.sold_price - s.fees - COALESCE(s.taxes_collected, 0) - COALESCE(s.shipping_cost, 0)) as net_payout,
  (s.sold_price - s.fees - COALESCE(s.taxes_collected, 0) - COALESCE(s.shipping_cost, 0) - COALESCE(i.cost_basis, 0)) as net_profit,
  CASE 
    WHEN COALESCE(i.cost_basis, 0) > 0 
    THEN ROUND(((s.sold_price - s.fees - COALESCE(s.taxes_collected, 0) - COALESCE(s.shipping_cost, 0) - COALESCE(i.cost_basis, 0)) / i.cost_basis * 100)::numeric, 1)
    ELSE NULL 
  END as roi_percent
FROM inventory_items i
JOIN sales s ON s.item_id = i.id
LEFT JOIN sessions sess ON s.session_id = sess.id
WHERE i.status = 'SOLD';

GRANT SELECT ON lyvefolio_items_sold TO authenticated;

-- ================================================================
-- 9. FUNCTION: Get Lyvefolio Summary Stats
-- ================================================================

CREATE OR REPLACE FUNCTION get_lyvefolio_stats(p_user_id uuid)
RETURNS TABLE (
  total_active_items bigint,
  total_spent numeric,
  total_sold_items bigint,
  total_revenue numeric,
  total_profit numeric,
  avg_roi numeric,
  total_estimated_value numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH active_stats AS (
    SELECT 
      COUNT(*) as active_count,
      COALESCE(SUM(cost_basis), 0) as total_cost,
      COALESCE(SUM(estimated_value), 0) as est_value
    FROM inventory_items
    WHERE user_id = p_user_id AND status = 'ACTIVE'
  ),
  sold_stats AS (
    SELECT 
      COUNT(*) as sold_count,
      COALESCE(SUM(s.sold_price), 0) as revenue,
      COALESCE(SUM(s.sold_price - s.fees - COALESCE(s.taxes_collected, 0) - COALESCE(s.shipping_cost, 0) - COALESCE(i.cost_basis, 0)), 0) as profit
    FROM sales s
    JOIN inventory_items i ON s.item_id = i.id
    WHERE s.user_id = p_user_id
  ),
  roi_stats AS (
    SELECT 
      CASE 
        WHEN SUM(CASE WHEN i.cost_basis > 0 THEN 1 ELSE 0 END) > 0
        THEN AVG(CASE 
          WHEN i.cost_basis > 0 
          THEN ((s.sold_price - s.fees - COALESCE(s.taxes_collected, 0) - COALESCE(s.shipping_cost, 0) - i.cost_basis) / i.cost_basis * 100)
          ELSE NULL 
        END)
        ELSE NULL
      END as avg_roi_calc
    FROM sales s
    JOIN inventory_items i ON s.item_id = i.id
    WHERE s.user_id = p_user_id AND i.cost_basis > 0
  )
  SELECT 
    a.active_count,
    a.total_cost,
    ss.sold_count,
    ss.revenue,
    ss.profit,
    ROUND(r.avg_roi_calc::numeric, 1),
    a.est_value
  FROM active_stats a, sold_stats ss, roi_stats r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 10. RLS POLICY: Users can only see their own items
-- ================================================================

-- Ensure inventory_items has user_id populated
UPDATE inventory_items 
SET user_id = sessions.user_id
FROM sessions
WHERE inventory_items.session_id = sessions.id
AND inventory_items.user_id IS NULL;

-- Add RLS policy for direct user_id access
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own inventory items directly' AND tablename = 'inventory_items') THEN
    CREATE POLICY "Users can view own inventory items directly"
      ON inventory_items FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own inventory items directly' AND tablename = 'inventory_items') THEN
    CREATE POLICY "Users can insert own inventory items directly"
      ON inventory_items FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own inventory items directly' AND tablename = 'inventory_items') THEN
    CREATE POLICY "Users can update own inventory items directly"
      ON inventory_items FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own inventory items directly' AND tablename = 'inventory_items') THEN
    CREATE POLICY "Users can delete own inventory items directly"
      ON inventory_items FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
