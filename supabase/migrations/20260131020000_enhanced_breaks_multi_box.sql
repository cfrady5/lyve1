-- ================================================================
-- ENHANCED BREAKS WITH MULTI-BOX CONFIGURATION
-- Adds support for quantity, expense allocation, and per-break breakeven
-- ================================================================

-- ================================================================
-- 1. ENHANCE BREAKS TABLE
-- ================================================================

-- Add expense allocation and profit target fields
ALTER TABLE breaks ADD COLUMN IF NOT EXISTS profit_target_amount numeric(10,2) DEFAULT 0;
ALTER TABLE breaks ADD COLUMN IF NOT EXISTS include_expenses_allocation boolean DEFAULT true;
ALTER TABLE breaks ADD COLUMN IF NOT EXISTS expenses_allocation_method text DEFAULT 'pro_rata_cost'
  CHECK (expenses_allocation_method IN ('pro_rata_cost', 'equal_per_break', 'manual'));
ALTER TABLE breaks ADD COLUMN IF NOT EXISTS manual_allocated_expense numeric(10,2) DEFAULT 0;

-- Add teams_count and players_count for better config
ALTER TABLE breaks ADD COLUMN IF NOT EXISTS teams_count integer DEFAULT 30;
ALTER TABLE breaks ADD COLUMN IF NOT EXISTS players_count integer;
ALTER TABLE breaks ADD COLUMN IF NOT EXISTS spot_config_type text
  CHECK (spot_config_type IN ('TEAM_30', 'THREE_TEAM_10', 'CUSTOM'));

COMMENT ON COLUMN breaks.profit_target_amount IS 'Optional per-break profit target override (defaults to session-level)';
COMMENT ON COLUMN breaks.include_expenses_allocation IS 'Whether to include allocated session expenses in breakeven';
COMMENT ON COLUMN breaks.expenses_allocation_method IS 'How to allocate expenses: pro_rata_cost, equal_per_break, or manual';
COMMENT ON COLUMN breaks.manual_allocated_expense IS 'Manual expense allocation if method is manual';
COMMENT ON COLUMN breaks.teams_count IS 'Number of teams for PYT or team-based random breaks';
COMMENT ON COLUMN breaks.players_count IS 'Number of players for PYP breaks';
COMMENT ON COLUMN breaks.spot_config_type IS 'Spot configuration type for random/drafted breaks';

-- Backfill teams_count based on spot_count for existing breaks
UPDATE breaks
SET teams_count = spot_count
WHERE break_style = 'pyt' AND teams_count IS NULL;

UPDATE breaks
SET players_count = spot_count
WHERE break_style = 'pyp' AND players_count IS NULL;

-- ================================================================
-- 2. ENHANCE BREAK_BOXES TABLE FOR MULTI-BOX SUPPORT
-- ================================================================

-- Add quantity and product_name fields
ALTER TABLE break_boxes ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE break_boxes ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1 CHECK (quantity > 0);
ALTER TABLE break_boxes ADD COLUMN IF NOT EXISTS price_paid_per_box numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE break_boxes ADD COLUMN IF NOT EXISTS total_cost numeric(10,2) GENERATED ALWAYS AS (quantity * price_paid_per_box) STORED;

COMMENT ON COLUMN break_boxes.product_name IS 'Name of the box/product (e.g., "Bowman Draft Hobby")';
COMMENT ON COLUMN break_boxes.quantity IS 'Number of boxes of this product type';
COMMENT ON COLUMN break_boxes.price_paid_per_box IS 'Price paid per individual box';
COMMENT ON COLUMN break_boxes.total_cost IS 'Computed total: quantity * price_paid_per_box';

-- Backfill existing data
UPDATE break_boxes
SET product_name = box_name,
    price_paid_per_box = box_cost,
    quantity = 1
WHERE product_name IS NULL;

-- ================================================================
-- 3. HELPER FUNCTION: CALCULATE BREAK BREAKEVEN
-- ================================================================

-- Function to calculate breakeven for a single break
CREATE OR REPLACE FUNCTION calculate_break_breakeven(
  p_break_id uuid,
  p_include_profit_target boolean DEFAULT true
)
RETURNS TABLE (
  box_cost numeric,
  allocated_expenses numeric,
  profit_target numeric,
  fee_rate numeric,
  required_revenue numeric,
  spot_count integer,
  required_per_spot numeric
) AS $$
DECLARE
  v_break record;
  v_session record;
  v_box_cost numeric;
  v_allocated_expenses numeric := 0;
  v_profit_target numeric := 0;
  v_fee_rate numeric;
  v_required_revenue numeric;
  v_required_per_spot numeric;
  v_total_session_expenses numeric;
  v_total_session_outlay numeric;
  v_break_count integer;
BEGIN
  -- Get break data
  SELECT * INTO v_break
  FROM breaks
  WHERE id = p_break_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Break not found: %', p_break_id;
  END IF;

  -- Get session data
  SELECT * INTO v_session
  FROM sessions
  WHERE id = v_break.session_id;

  -- Calculate box cost
  IF v_break.break_type = 'mixer' THEN
    -- Sum all boxes for mixer
    SELECT COALESCE(SUM(bb.quantity * bb.price_paid_per_box), 0) INTO v_box_cost
    FROM break_boxes bb
    WHERE bb.break_id = p_break_id;
  ELSE
    -- Use break's box_cost for single product
    v_box_cost := v_break.box_cost;
  END IF;

  -- Calculate allocated expenses if enabled
  IF v_break.include_expenses_allocation THEN
    -- Get total session expenses
    SELECT COALESCE(SUM(amount), 0) INTO v_total_session_expenses
    FROM session_expenses
    WHERE session_id = v_break.session_id;

    IF v_break.expenses_allocation_method = 'manual' THEN
      v_allocated_expenses := COALESCE(v_break.manual_allocated_expense, 0);
    ELSIF v_break.expenses_allocation_method = 'equal_per_break' THEN
      -- Count breaks in session
      SELECT COUNT(*) INTO v_break_count
      FROM breaks
      WHERE session_id = v_break.session_id;

      IF v_break_count > 0 THEN
        v_allocated_expenses := v_total_session_expenses / v_break_count;
      END IF;
    ELSIF v_break.expenses_allocation_method = 'pro_rata_cost' THEN
      -- Calculate total session outlay
      SELECT COALESCE(
        (SELECT SUM(ii.cost_basis)
         FROM session_items si
         JOIN inventory_items ii ON ii.id = si.item_id
         WHERE si.session_id = v_break.session_id) +
        (SELECT SUM(
           CASE
             WHEN b.break_type = 'mixer' THEN (
               SELECT COALESCE(SUM(bb.quantity * bb.price_paid_per_box), 0)
               FROM break_boxes bb
               WHERE bb.break_id = b.id
             )
             ELSE b.box_cost
           END
         )
         FROM breaks b
         WHERE b.session_id = v_break.session_id),
        0
      ) INTO v_total_session_outlay;

      IF v_total_session_outlay > 0 THEN
        v_allocated_expenses := v_total_session_expenses * (v_box_cost / v_total_session_outlay);
      END IF;
    END IF;
  END IF;

  -- Calculate profit target
  IF p_include_profit_target THEN
    IF v_break.profit_target_amount > 0 THEN
      v_profit_target := v_break.profit_target_amount;
    ELSIF v_session.profit_target_amount > 0 THEN
      -- Use session-level profit target pro-rated by cost
      SELECT COALESCE(
        (SELECT SUM(ii.cost_basis)
         FROM session_items si
         JOIN inventory_items ii ON ii.id = si.item_id
         WHERE si.session_id = v_break.session_id) +
        (SELECT SUM(
           CASE
             WHEN b.break_type = 'mixer' THEN (
               SELECT COALESCE(SUM(bb.quantity * bb.price_paid_per_box), 0)
               FROM break_boxes bb
               WHERE bb.break_id = b.id
             )
             ELSE b.box_cost
           END
         )
         FROM breaks b
         WHERE b.session_id = v_break.session_id),
        0
      ) INTO v_total_session_outlay;

      IF v_total_session_outlay > 0 THEN
        v_profit_target := v_session.profit_target_amount * (v_box_cost / v_total_session_outlay);
      END IF;
    END IF;
  END IF;

  -- Get fee rate (break override or session default)
  v_fee_rate := COALESCE(v_break.estimated_fee_rate, v_session.estimated_fee_rate, 0.12);

  -- Prevent division by zero
  IF v_fee_rate >= 1.0 THEN
    v_fee_rate := 0.12;
  END IF;

  -- Calculate required revenue: (box_cost + allocated_expenses + profit_target) / (1 - fee_rate)
  v_required_revenue := (v_box_cost + v_allocated_expenses + v_profit_target) / (1.0 - v_fee_rate);

  -- Calculate required per spot
  IF v_break.spot_count > 0 THEN
    v_required_per_spot := v_required_revenue / v_break.spot_count;
  ELSE
    v_required_per_spot := 0;
  END IF;

  RETURN QUERY SELECT
    v_box_cost,
    v_allocated_expenses,
    v_profit_target,
    v_fee_rate,
    v_required_revenue,
    v_break.spot_count,
    v_required_per_spot;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_break_breakeven IS 'Calculate breakeven metrics for a single break including expense allocation';

-- ================================================================
-- 4. UPDATE SESSION BREAKEVEN FUNCTION TO INCLUDE BREAKS
-- ================================================================

-- This updates the existing calculate_breakeven_revenue to properly handle mixer breaks
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

  -- Calculate total break cost (properly handling mixers with quantity)
  SELECT COALESCE(SUM(
    CASE
      WHEN b.break_type = 'mixer' THEN (
        SELECT COALESCE(SUM(bb.quantity * bb.price_paid_per_box), 0)
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
