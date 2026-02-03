-- ================================================================
-- FIX BREAK_BOXES RLS POLICIES
-- The INSERT policy was too strict, causing failures when adding boxes
-- ================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert break_boxes for their sessions" ON break_boxes;
DROP POLICY IF EXISTS "Users can update break_boxes for their sessions" ON break_boxes;
DROP POLICY IF EXISTS "Users can delete break_boxes for their sessions" ON break_boxes;
DROP POLICY IF EXISTS "Users can view break_boxes for their sessions" ON break_boxes;

-- Recreate with corrected policies

-- SELECT: Users can view break_boxes for their sessions
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

-- INSERT: Users can insert break_boxes for their sessions
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

-- UPDATE: Users can update break_boxes for their sessions
CREATE POLICY "Users can update break_boxes for their sessions"
  ON break_boxes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM breaks
      JOIN sessions ON sessions.id = breaks.session_id
      WHERE breaks.id = break_boxes.break_id
      AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM breaks
      JOIN sessions ON sessions.id = breaks.session_id
      WHERE breaks.id = break_boxes.break_id
      AND sessions.user_id = auth.uid()
    )
  );

-- DELETE: Users can delete break_boxes for their sessions
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

-- Grant necessary permissions (just to be safe)
GRANT SELECT, INSERT, UPDATE, DELETE ON break_boxes TO authenticated;

COMMENT ON POLICY "Users can view break_boxes for their sessions" ON break_boxes IS 'Allow users to view break boxes for breaks in their sessions';
COMMENT ON POLICY "Users can insert break_boxes for their sessions" ON break_boxes IS 'Allow users to insert break boxes for breaks in their sessions';
COMMENT ON POLICY "Users can update break_boxes for their sessions" ON break_boxes IS 'Allow users to update break boxes for breaks in their sessions';
COMMENT ON POLICY "Users can delete break_boxes for their sessions" ON break_boxes IS 'Allow users to delete break boxes for breaks in their sessions';
