-- ================================================================
-- SESSIONS LIVESTREAM WORKFLOW
-- Purpose-built for livestream sellers to prep, run, and reconcile
-- ================================================================

-- ================================================================
-- 1. ENHANCE SESSIONS TABLE
-- ================================================================

-- Add session workflow columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS date timestamptz DEFAULT now();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS platform text DEFAULT 'whatnot' 
  CHECK (platform IN ('whatnot', 'ebay', 'instagram', 'show', 'other'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'DRAFT' 
  CHECK (status IN ('DRAFT', 'FINALIZED', 'RECONCILED'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS estimated_fee_rate numeric(5,4) DEFAULT 0.12;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tax_rate_default numeric(5,4) DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill title from name if empty
UPDATE sessions SET title = name WHERE title IS NULL;

-- Create index for session queries
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_platform ON sessions(platform);

-- ================================================================
-- 2. ENHANCE SESSION_ITEMS JOIN TABLE
-- ================================================================

-- Add item_number and metadata columns
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS item_number integer;
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS added_via text DEFAULT 'manual'
  CHECK (added_via IN ('photo', 'preshow_csv', 'manual', 'batch'));
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create unique constraint for item_number per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_items_item_number 
  ON session_items(session_id, item_number) WHERE item_number IS NOT NULL;

-- Backfill item_number from position where needed
UPDATE session_items
SET item_number = position
WHERE item_number IS NULL AND position IS NOT NULL;

-- Backfill session_items from inventory_items that still have session_id
INSERT INTO session_items (session_id, item_id, item_number, position, created_at)
SELECT
  i.session_id,
  i.id as item_id,
  i.card_number as item_number,
  i.card_number as position,
  i.created_at
FROM inventory_items i
WHERE i.session_id IS NOT NULL
  AND i.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM session_items si
    WHERE si.item_id = i.id AND si.session_id = i.session_id
  )
ON CONFLICT (session_id, item_id) DO NOTHING;

-- ================================================================
-- 3. SESSION EXPENSES TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS session_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'misc'
    CHECK (category IN ('supplies', 'shipping_materials', 'promo', 'show_fee', 'travel', 'misc')),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE session_expenses IS 'Session-level expenses for supplies, fees, etc.';

CREATE INDEX IF NOT EXISTS idx_session_expenses_session ON session_expenses(session_id);
CREATE INDEX IF NOT EXISTS idx_session_expenses_category ON session_expenses(category);

-- Enable RLS
ALTER TABLE session_expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view session_expenses for their sessions"
  ON session_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_expenses.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert session_expenses for their sessions"
  ON session_expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_expenses.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update session_expenses for their sessions"
  ON session_expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_expenses.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete session_expenses for their sessions"
  ON session_expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_expenses.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- ================================================================
-- 4. BREAKS TABLE (Session-scoped box breaks)
-- ================================================================

CREATE TABLE IF NOT EXISTS breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  box_cost numeric(10,2) NOT NULL DEFAULT 0,
  slots_count integer NOT NULL DEFAULT 1,
  estimated_fee_rate numeric(5,4),
  position integer, -- Order in run list
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE breaks IS 'Box breaks within a session';

CREATE INDEX IF NOT EXISTS idx_breaks_session ON breaks(session_id);

-- Enable RLS
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view breaks for their sessions"
  ON breaks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = breaks.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert breaks for their sessions"
  ON breaks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = breaks.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update breaks for their sessions"
  ON breaks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = breaks.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete breaks for their sessions"
  ON breaks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = breaks.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- ================================================================
-- 5. BREAK SLOT SALES TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS break_slot_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  break_id uuid NOT NULL REFERENCES breaks(id) ON DELETE CASCADE,
  slot_number integer NOT NULL,
  sold_price numeric(10,2) NOT NULL DEFAULT 0,
  fees numeric(10,2) NOT NULL DEFAULT 0,
  taxes numeric(10,2) NOT NULL DEFAULT 0,
  net_profit numeric(10,2) GENERATED ALWAYS AS (sold_price - fees - taxes) STORED,
  buyer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(break_id, slot_number)
);

COMMENT ON TABLE break_slot_sales IS 'Individual slot sales within a break';

CREATE INDEX IF NOT EXISTS idx_break_slot_sales_break ON break_slot_sales(break_id);

-- Enable RLS
ALTER TABLE break_slot_sales ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view break_slot_sales for their sessions"
  ON break_slot_sales FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM breaks
      JOIN sessions ON sessions.id = breaks.session_id
      WHERE breaks.id = break_slot_sales.break_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert break_slot_sales for their sessions"
  ON break_slot_sales FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM breaks
      JOIN sessions ON sessions.id = breaks.session_id
      WHERE breaks.id = break_slot_sales.break_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update break_slot_sales for their sessions"
  ON break_slot_sales FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM breaks
      JOIN sessions ON sessions.id = breaks.session_id
      WHERE breaks.id = break_slot_sales.break_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete break_slot_sales for their sessions"
  ON break_slot_sales FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM breaks
      JOIN sessions ON sessions.id = breaks.session_id
      WHERE breaks.id = break_slot_sales.break_id
      AND sessions.user_id = auth.uid()
    )
  );

-- ================================================================
-- 6. ENSURE SALES TABLE HAS ALL REQUIRED COLUMNS
-- ================================================================

ALTER TABLE sales ADD COLUMN IF NOT EXISTS channel text DEFAULT 'whatnot';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS taxes numeric(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shipping numeric(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS net_profit numeric(10,2);

-- Add index for session sales queries
CREATE INDEX IF NOT EXISTS idx_sales_session_sold_at ON sales(session_id, sold_at);

-- ================================================================
-- 7. HELPER FUNCTIONS
-- ================================================================

-- Function: Get next item number for a session
CREATE OR REPLACE FUNCTION get_next_item_number(p_session_id uuid)
RETURNS integer AS $$
DECLARE
  v_max_number integer;
BEGIN
  SELECT COALESCE(MAX(item_number), 0) INTO v_max_number
  FROM session_items
  WHERE session_id = p_session_id;
  
  RETURN v_max_number + 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Add item to session with auto item_number
CREATE OR REPLACE FUNCTION add_item_to_session_v2(
  p_session_id uuid,
  p_item_id uuid,
  p_item_number integer DEFAULT NULL,
  p_added_via text DEFAULT 'manual'
)
RETURNS integer AS $$
DECLARE
  v_item_number integer;
  v_position integer;
BEGIN
  -- Get item_number (use provided or auto-assign)
  IF p_item_number IS NOT NULL THEN
    v_item_number := p_item_number;
  ELSE
    v_item_number := get_next_item_number(p_session_id);
  END IF;
  
  -- Position defaults to item_number
  v_position := v_item_number;
  
  -- Insert session_item
  INSERT INTO session_items (session_id, item_id, item_number, position, added_via)
  VALUES (p_session_id, p_item_id, v_item_number, v_position, p_added_via)
  ON CONFLICT (session_id, item_id) DO UPDATE 
  SET item_number = EXCLUDED.item_number,
      position = EXCLUDED.position,
      updated_at = now();
  
  RETURN v_item_number;
END;
$$ LANGUAGE plpgsql;

-- Function: Mark session item as sold (creates sale + updates item status)
CREATE OR REPLACE FUNCTION mark_session_item_sold(
  p_user_id uuid,
  p_item_id uuid,
  p_session_id uuid,
  p_sold_price numeric,
  p_fees numeric DEFAULT 0,
  p_taxes numeric DEFAULT 0,
  p_shipping numeric DEFAULT 0,
  p_channel text DEFAULT 'whatnot',
  p_sold_at timestamptz DEFAULT now()
)
RETURNS uuid AS $$
DECLARE
  v_sale_id uuid;
  v_cost_basis numeric;
  v_net_profit numeric;
BEGIN
  -- Get cost basis
  SELECT cost_basis INTO v_cost_basis
  FROM inventory_items
  WHERE id = p_item_id;
  
  -- Calculate net profit
  v_net_profit := p_sold_price - p_fees - p_taxes - p_shipping - COALESCE(v_cost_basis, 0);
  
  -- Create sale record
  INSERT INTO sales (
    user_id, item_id, session_id, channel,
    sold_price, fees, taxes, shipping, net_profit, sold_at
  ) VALUES (
    p_user_id, p_item_id, p_session_id, p_channel,
    p_sold_price, p_fees, p_taxes, p_shipping, v_net_profit, p_sold_at
  )
  RETURNING id INTO v_sale_id;
  
  -- Update item status to SOLD
  UPDATE inventory_items
  SET status = 'SOLD',
      lifecycle_status = 'sold',
      updated_at = now()
  WHERE id = p_item_id;
  
  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get session P&L summary
CREATE OR REPLACE FUNCTION get_session_pnl(p_session_id uuid)
RETURNS TABLE (
  total_items integer,
  sold_count integer,
  gross_revenue numeric,
  total_fees numeric,
  total_taxes numeric,
  total_shipping numeric,
  total_cogs numeric,
  total_expenses numeric,
  net_profit numeric,
  profit_margin numeric,
  sell_through_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH session_sales AS (
    SELECT 
      s.sold_price,
      s.fees,
      s.taxes,
      s.shipping,
      ii.cost_basis
    FROM sales s
    JOIN inventory_items ii ON ii.id = s.item_id
    WHERE s.session_id = p_session_id
  ),
  session_items_count AS (
    SELECT COUNT(*) as cnt
    FROM session_items
    WHERE session_id = p_session_id
  ),
  expenses_sum AS (
    SELECT COALESCE(SUM(amount), 0) as total
    FROM session_expenses
    WHERE session_id = p_session_id
  )
  SELECT
    (SELECT cnt::integer FROM session_items_count) as total_items,
    (SELECT COUNT(*)::integer FROM session_sales) as sold_count,
    COALESCE(SUM(ss.sold_price), 0)::numeric as gross_revenue,
    COALESCE(SUM(ss.fees), 0)::numeric as total_fees,
    COALESCE(SUM(ss.taxes), 0)::numeric as total_taxes,
    COALESCE(SUM(ss.shipping), 0)::numeric as total_shipping,
    COALESCE(SUM(ss.cost_basis), 0)::numeric as total_cogs,
    (SELECT total FROM expenses_sum)::numeric as total_expenses,
    (COALESCE(SUM(ss.sold_price), 0) - COALESCE(SUM(ss.fees), 0) - 
     COALESCE(SUM(ss.taxes), 0) - COALESCE(SUM(ss.shipping), 0) - 
     COALESCE(SUM(ss.cost_basis), 0) - (SELECT total FROM expenses_sum))::numeric as net_profit,
    CASE 
      WHEN COALESCE(SUM(ss.sold_price), 0) > 0 
      THEN ((COALESCE(SUM(ss.sold_price), 0) - COALESCE(SUM(ss.fees), 0) - 
             COALESCE(SUM(ss.taxes), 0) - COALESCE(SUM(ss.shipping), 0) - 
             COALESCE(SUM(ss.cost_basis), 0) - (SELECT total FROM expenses_sum)) / 
            COALESCE(SUM(ss.sold_price), 1) * 100)::numeric
      ELSE 0::numeric
    END as profit_margin,
    CASE 
      WHEN (SELECT cnt FROM session_items_count) > 0 
      THEN ((SELECT COUNT(*)::numeric FROM session_sales) / 
            (SELECT cnt::numeric FROM session_items_count) * 100)
      ELSE 0::numeric
    END as sell_through_rate
  FROM session_sales ss;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 8. VIEWS FOR COMMON QUERIES
-- ================================================================

-- Session overview with stats
CREATE OR REPLACE VIEW session_overview AS
SELECT 
  s.id,
  s.user_id,
  s.name,
  s.title,
  s.date,
  s.platform,
  s.status,
  s.estimated_fee_rate,
  s.tax_rate_default,
  s.created_at,
  s.updated_at,
  s.finalized_at,
  s.reconciled_at,
  COALESCE(item_stats.item_count, 0) as item_count,
  COALESCE(item_stats.total_cost, 0) as total_inventory_cost,
  COALESCE(expense_stats.total_expenses, 0) as total_expenses,
  COALESCE(sale_stats.sold_count, 0) as sold_count,
  COALESCE(sale_stats.gross_revenue, 0) as gross_revenue,
  COALESCE(sale_stats.total_fees, 0) as total_fees,
  COALESCE(sale_stats.net_profit, 0) as net_profit
FROM sessions s
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) as item_count,
    COALESCE(SUM(ii.cost_basis), 0) as total_cost
  FROM session_items si
  JOIN inventory_items ii ON ii.id = si.item_id
  WHERE si.session_id = s.id
) item_stats ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) as total_expenses
  FROM session_expenses
  WHERE session_id = s.id
) expense_stats ON true
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) as sold_count,
    COALESCE(SUM(sold_price), 0) as gross_revenue,
    COALESCE(SUM(fees), 0) as total_fees,
    COALESCE(SUM(net_profit), 0) as net_profit
  FROM sales
  WHERE session_id = s.id
) sale_stats ON true;

-- ================================================================
-- 9. UPDATE TRIGGERS
-- ================================================================

-- Trigger to update updated_at on sessions
CREATE OR REPLACE FUNCTION update_session_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sessions_updated_at ON sessions;
CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_timestamp();

-- Trigger to update updated_at on session_items
DROP TRIGGER IF EXISTS session_items_updated_at ON session_items;
CREATE TRIGGER session_items_updated_at
  BEFORE UPDATE ON session_items
  FOR EACH ROW
  EXECUTE FUNCTION update_session_timestamp();

-- Trigger to update updated_at on session_expenses
DROP TRIGGER IF EXISTS session_expenses_updated_at ON session_expenses;
CREATE TRIGGER session_expenses_updated_at
  BEFORE UPDATE ON session_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_session_timestamp();

-- Trigger to update updated_at on breaks
DROP TRIGGER IF EXISTS breaks_updated_at ON breaks;
CREATE TRIGGER breaks_updated_at
  BEFORE UPDATE ON breaks
  FOR EACH ROW
  EXECUTE FUNCTION update_session_timestamp();
