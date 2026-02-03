-- ================================================================
-- PRESHOW UNIFIED EXPERIENCE
-- Single-page pre-show with show types, break styles, and breakeven
-- ================================================================

-- ================================================================
-- 1. ENHANCE SESSIONS TABLE FOR SHOW TYPES & BREAKEVEN CONFIG
-- ================================================================

-- Add show type and breakeven configuration columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS show_type text DEFAULT 'singles_only'
  CHECK (show_type IN ('singles_only', 'breaks_only', 'mixed'));

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS profit_target_amount numeric(10,2) DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS profit_target_percent numeric(5,2) DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revenue_allocation_singles_percent numeric(5,2) DEFAULT 50.00;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS sell_through_singles_percent numeric(5,2) DEFAULT 100.00;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS sell_through_breaks_percent numeric(5,2) DEFAULT 100.00;

COMMENT ON COLUMN sessions.show_type IS 'Type of show: singles_only, breaks_only, or mixed';
COMMENT ON COLUMN sessions.profit_target_amount IS 'Optional profit target in dollars';
COMMENT ON COLUMN sessions.profit_target_percent IS 'Optional profit target as percentage';
COMMENT ON COLUMN sessions.revenue_allocation_singles_percent IS 'For mixed shows: expected % of revenue from singles (0-100)';
COMMENT ON COLUMN sessions.sell_through_singles_percent IS 'Expected sell-through rate for singles (0-100)';
COMMENT ON COLUMN sessions.sell_through_breaks_percent IS 'Expected sell-through rate for breaks (0-100)';

-- Create index for show type queries
CREATE INDEX IF NOT EXISTS idx_sessions_show_type ON sessions(show_type);

-- ================================================================
-- 2. ENHANCE BREAKS TABLE FOR BREAK STYLES & CONFIGURATIONS
-- ================================================================

-- Add break style and configuration columns
ALTER TABLE breaks ADD COLUMN IF NOT EXISTS break_style text DEFAULT 'random_drafted'
  CHECK (break_style IN ('pyt', 'pyp', 'random_drafted'));

ALTER TABLE breaks ADD COLUMN IF NOT EXISTS break_type text DEFAULT 'single_product'
  CHECK (break_type IN ('single_product', 'mixer'));

ALTER TABLE breaks ADD COLUMN IF NOT EXISTS spot_count integer;
ALTER TABLE breaks ADD COLUMN IF NOT EXISTS spot_type text;

COMMENT ON COLUMN breaks.break_style IS 'Break style: pyt (Pick Your Team), pyp (Pick Your Player), random_drafted';
COMMENT ON COLUMN breaks.break_type IS 'single_product or mixer (multiple boxes)';
COMMENT ON COLUMN breaks.spot_count IS 'Number of spots/slots in the break';
COMMENT ON COLUMN breaks.spot_type IS 'For random_drafted: team_30, three_team_10, or custom';

-- Backfill spot_count from slots_count
UPDATE breaks SET spot_count = slots_count WHERE spot_count IS NULL;

-- Create index for break style queries
CREATE INDEX IF NOT EXISTS idx_breaks_style ON breaks(break_style);

-- ================================================================
-- 3. ENHANCE SESSION_EXPENSES FOR PAYROLL & METADATA
-- ================================================================

-- Add metadata column for structured data like payroll inputs
ALTER TABLE session_expenses ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Update category enum to include new categories
ALTER TABLE session_expenses DROP CONSTRAINT IF EXISTS session_expenses_category_check;
ALTER TABLE session_expenses ADD CONSTRAINT session_expenses_category_check
  CHECK (category IN (
    'logistics_supplies',
    'shipping_materials',
    'grading_auth',
    'payroll',
    'promo',
    'show_fee',
    'travel',
    'misc'
  ));

COMMENT ON COLUMN session_expenses.metadata IS 'JSON metadata for structured data (e.g., payroll: {breakers: 2, hourly_rate: 15, hours: 4})';

-- ================================================================
-- 4. CREATE BREAK BOXES TABLE FOR MIXER SUPPORT
-- ================================================================

CREATE TABLE IF NOT EXISTS break_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  break_id uuid NOT NULL REFERENCES breaks(id) ON DELETE CASCADE,
  box_name text,
  box_cost numeric(10,2) NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE break_boxes IS 'Individual boxes within a mixer break';

CREATE INDEX IF NOT EXISTS idx_break_boxes_break ON break_boxes(break_id);

-- Enable RLS
ALTER TABLE break_boxes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view break_boxes for their sessions"
  ON break_boxes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM breaks
      JOIN sessions ON sessions.id = breaks.session_id
      WHERE breaks.id = break_boxes.break_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert break_boxes for their sessions"
  ON break_boxes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM breaks
      JOIN sessions ON sessions.id = breaks.session_id
      WHERE breaks.id = break_boxes.break_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update break_boxes for their sessions"
  ON break_boxes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM breaks
      JOIN sessions ON sessions.id = breaks.session_id
      WHERE breaks.id = break_boxes.break_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete break_boxes for their sessions"
  ON break_boxes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM breaks
      JOIN sessions ON sessions.id = breaks.session_id
      WHERE breaks.id = break_boxes.break_id
      AND sessions.user_id = auth.uid()
    )
  );

-- ================================================================
-- 5. HELPER FUNCTIONS FOR BREAKEVEN CALCULATIONS
-- ================================================================

-- Function: Calculate breakeven revenue for a session
CREATE OR REPLACE FUNCTION calculate_breakeven_revenue(
  p_session_id uuid,
  p_include_profit_target boolean DEFAULT true
)
RETURNS TABLE (
  total_inventory_cost numeric,
  total_break_cost numeric,
  total_expenses numeric,
  total_outlay numeric,
  profit_target numeric,
  estimated_fee_rate numeric,
  breakeven_revenue numeric
) AS $$
DECLARE
  v_session record;
  v_inventory_cost numeric;
  v_break_cost numeric;
  v_expenses numeric;
  v_total_outlay numeric;
  v_profit_target numeric;
  v_fee_rate numeric;
  v_breakeven numeric;
BEGIN
  -- Get session data
  SELECT * INTO v_session
  FROM sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  -- Calculate total inventory cost
  SELECT COALESCE(SUM(ii.cost_basis), 0) INTO v_inventory_cost
  FROM session_items si
  JOIN inventory_items ii ON ii.id = si.item_id
  WHERE si.session_id = p_session_id;

  -- Calculate total break cost (including mixer boxes)
  SELECT COALESCE(SUM(
    CASE
      WHEN b.break_type = 'mixer' THEN (
        SELECT COALESCE(SUM(bb.box_cost), 0)
        FROM break_boxes bb
        WHERE bb.break_id = b.id
      )
      ELSE b.box_cost
    END
  ), 0) INTO v_break_cost
  FROM breaks b
  WHERE b.session_id = p_session_id;

  -- Calculate total expenses
  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM session_expenses
  WHERE session_id = p_session_id;

  -- Total outlay
  v_total_outlay := v_inventory_cost + v_break_cost + v_expenses;

  -- Profit target
  v_profit_target := 0;
  IF p_include_profit_target THEN
    IF v_session.profit_target_amount > 0 THEN
      v_profit_target := v_session.profit_target_amount;
    ELSIF v_session.profit_target_percent > 0 THEN
      v_profit_target := v_total_outlay * (v_session.profit_target_percent / 100.0);
    END IF;
  END IF;

  -- Fee rate
  v_fee_rate := COALESCE(v_session.estimated_fee_rate, 0.12);

  -- Breakeven formula: (Total Outlay + Profit Target) / (1 - Fee Rate)
  IF v_fee_rate >= 1.0 THEN
    v_fee_rate := 0.12; -- Prevent division by zero or negative
  END IF;

  v_breakeven := (v_total_outlay + v_profit_target) / (1.0 - v_fee_rate);

  RETURN QUERY SELECT
    v_inventory_cost,
    v_break_cost,
    v_expenses,
    v_total_outlay,
    v_profit_target,
    v_fee_rate,
    v_breakeven;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 6. UPDATE TRIGGERS
-- ================================================================

-- Trigger to update updated_at on break_boxes
DROP TRIGGER IF EXISTS break_boxes_updated_at ON break_boxes;
CREATE TRIGGER break_boxes_updated_at
  BEFORE UPDATE ON break_boxes
  FOR EACH ROW
  EXECUTE FUNCTION update_session_timestamp();
