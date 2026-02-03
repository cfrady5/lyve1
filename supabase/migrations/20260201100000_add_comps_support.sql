-- ================================================================
-- COMPS SUPPORT FOR LYVEVALUE AND LYVERANGE
-- Add eBay comps integration with audit history
-- ================================================================

-- ================================================================
-- 1. ADD COMPS COLUMNS TO INVENTORY_ITEMS
-- ================================================================

-- Query used to fetch comps
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS comp_query text;

-- LyveValue and LyveRange
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lyve_value numeric(10,2);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lyve_range_low numeric(10,2);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lyve_range_high numeric(10,2);

-- Comp metadata
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lyve_comp_source text
  CHECK (lyve_comp_source IN ('ebay_sold', 'ebay_active'));
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lyve_comp_sample_size integer;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lyve_value_updated_at timestamptz;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lyve_comp_confidence text
  CHECK (lyve_comp_confidence IN ('low', 'medium', 'high'));

-- Add indexes for comp queries
CREATE INDEX IF NOT EXISTS idx_inventory_lyve_value_updated ON inventory_items(lyve_value_updated_at) WHERE lifecycle_status = 'active';
CREATE INDEX IF NOT EXISTS idx_inventory_comp_confidence ON inventory_items(lyve_comp_confidence);

-- Comments
COMMENT ON COLUMN inventory_items.comp_query IS 'Search query used to fetch eBay comps';
COMMENT ON COLUMN inventory_items.lyve_value IS 'Center estimate from eBay comps (median price)';
COMMENT ON COLUMN inventory_items.lyve_range_low IS 'Low estimate (p25 or trimmed low)';
COMMENT ON COLUMN inventory_items.lyve_range_high IS 'High estimate (p75 or trimmed high)';
COMMENT ON COLUMN inventory_items.lyve_comp_source IS 'Source: ebay_sold (sold comps) or ebay_active (active listings)';
COMMENT ON COLUMN inventory_items.lyve_comp_sample_size IS 'Number of comps used in calculation';
COMMENT ON COLUMN inventory_items.lyve_value_updated_at IS 'Last time comps were refreshed';
COMMENT ON COLUMN inventory_items.lyve_comp_confidence IS 'Confidence level: low (N<5), medium (N 5-9), high (N>=10 with tight spread)';

-- ================================================================
-- 2. ADD STRUCTURED METADATA COLUMNS (if not already present)
-- ================================================================

-- These enable accurate query building for sports cards
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS parallel text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS grader text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cert_number text;

-- Indexes for metadata queries
CREATE INDEX IF NOT EXISTS idx_inventory_sport ON inventory_items(sport);
CREATE INDEX IF NOT EXISTS idx_inventory_grader ON inventory_items(grader);

-- Comments
COMMENT ON COLUMN inventory_items.sport IS 'Sport type: basketball, baseball, football, etc';
COMMENT ON COLUMN inventory_items.brand IS 'Card brand/manufacturer: Prizm, Topps, Bowman, etc';
COMMENT ON COLUMN inventory_items.parallel IS 'Parallel/variation: Silver, Gold, Base, etc';
COMMENT ON COLUMN inventory_items.grader IS 'Grading company: PSA, BGS, SGC, etc';
COMMENT ON COLUMN inventory_items.cert_number IS 'Certification number from grading company';

-- ================================================================
-- 3. CREATE ITEM_COMPS TABLE (history and audit)
-- ================================================================

CREATE TABLE IF NOT EXISTS item_comps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

  -- Comp source and query
  source text NOT NULL CHECK (source IN ('ebay_sold', 'ebay_active')),
  query text NOT NULL,
  marketplace text DEFAULT 'EBAY_US',

  -- Sample statistics
  sample_size integer NOT NULL,
  median_price numeric(10,2),
  avg_price numeric(10,2),
  p25 numeric(10,2),
  p75 numeric(10,2),
  min_trim numeric(10,2),
  max_trim numeric(10,2),

  -- Currency and timing
  currency text DEFAULT 'USD',
  retrieved_at timestamptz NOT NULL DEFAULT now(),

  -- Raw observations (for audit)
  observations jsonb NOT NULL,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_item_comps_item ON item_comps(item_id, retrieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_comps_source ON item_comps(source);
CREATE INDEX IF NOT EXISTS idx_item_comps_retrieved ON item_comps(retrieved_at);

-- Enable RLS
ALTER TABLE item_comps ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view item_comps for their items"
  ON item_comps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inventory_items
      WHERE inventory_items.id = item_comps.item_id
      AND inventory_items.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert item_comps"
  ON item_comps FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update item_comps"
  ON item_comps FOR UPDATE
  USING (true);

-- Comments
COMMENT ON TABLE item_comps IS 'History and audit trail of comp refreshes with computed statistics';
COMMENT ON COLUMN item_comps.source IS 'ebay_sold = sold transaction comps (preferred), ebay_active = active listing comps (fallback)';
COMMENT ON COLUMN item_comps.query IS 'Search query used to fetch these comps';
COMMENT ON COLUMN item_comps.observations IS 'Array of normalized price observations used in calculation';
COMMENT ON COLUMN item_comps.median_price IS 'Median price (LyveValue)';
COMMENT ON COLUMN item_comps.p25 IS '25th percentile (LyveRange low)';
COMMENT ON COLUMN item_comps.p75 IS '75th percentile (LyveRange high)';

-- ================================================================
-- 4. HELPER FUNCTION: Get items needing comp refresh
-- ================================================================

CREATE OR REPLACE FUNCTION get_items_needing_comp_refresh(
  p_user_id uuid,
  p_days_threshold integer DEFAULT 7,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  item_id uuid,
  name text,
  player text,
  year integer,
  set_name text,
  grade text,
  last_updated timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ii.id as item_id,
    ii.name,
    ii.player,
    ii.year,
    ii.set_name,
    ii.grade,
    ii.lyve_value_updated_at as last_updated
  FROM inventory_items ii
  WHERE ii.user_id = p_user_id
    AND ii.lifecycle_status = 'active'
    AND (
      ii.lyve_value_updated_at IS NULL
      OR ii.lyve_value_updated_at < (now() - (p_days_threshold || ' days')::interval)
    )
  ORDER BY
    CASE WHEN ii.lyve_value_updated_at IS NULL THEN 0 ELSE 1 END,
    ii.lyve_value_updated_at ASC NULLS FIRST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_items_needing_comp_refresh IS 'Returns active items that need comp refresh (null or older than threshold days)';
