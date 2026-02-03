-- ================================================================
-- ADD TEST INVENTORY ITEMS
-- Adds sample inventory items to the demo session
-- ================================================================

DO $$
DECLARE
  v_user_id uuid := '11111111-1111-1111-1111-111111111111';
  v_session_id uuid := 'd22d6bfc-3dbc-48fd-a35c-aa20496ab048';
  v_item_ids uuid[];
BEGIN
  -- Create some inventory items
  WITH inserted_items AS (
    INSERT INTO inventory_items (
      user_id,
      name,
      display_name,
      cost_basis,
      status,
      lifecycle_status,
      created_at
    ) VALUES
      (v_user_id, 'Patrick Mahomes 2017 Prizm RC', 'Mahomes Prizm RC', 45.00, 'ACTIVE', 'active', now()),
      (v_user_id, 'Justin Herbert 2020 Mosaic RC', 'Herbert Mosaic RC', 25.00, 'ACTIVE', 'active', now()),
      (v_user_id, 'CJ Stroud 2023 Prizm RC', 'Stroud Prizm RC', 30.00, 'ACTIVE', 'active', now()),
      (v_user_id, 'Brock Purdy 2022 Prizm RC', 'Purdy Prizm RC', 20.00, 'ACTIVE', 'active', now()),
      (v_user_id, 'Anthony Richardson 2023 Select RC', 'Richardson Select RC', 15.00, 'ACTIVE', 'active', now())
    RETURNING id
  )
  SELECT array_agg(id) INTO v_item_ids FROM inserted_items;

  RAISE NOTICE 'Created % inventory items', array_length(v_item_ids, 1);

  -- Add items to the session
  INSERT INTO session_items (session_id, item_id, item_number, position, added_via, created_at)
  SELECT
    v_session_id,
    unnest(v_item_ids),
    generate_series(1, array_length(v_item_ids, 1)),
    generate_series(1, array_length(v_item_ids, 1)),
    'manual',
    now();

  RAISE NOTICE 'Added items to session';

  -- Update session to Mixed type
  UPDATE sessions
  SET show_type = 'mixed'
  WHERE id = v_session_id;

  RAISE NOTICE 'Updated session to Mixed type';

  -- Calculate totals
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Inventory items added successfully!';
  RAISE NOTICE 'Total inventory cost: $135.00';
  RAISE NOTICE '  - Mahomes: $45.00';
  RAISE NOTICE '  - Herbert: $25.00';
  RAISE NOTICE '  - Stroud: $30.00';
  RAISE NOTICE '  - Purdy: $20.00';
  RAISE NOTICE '  - Richardson: $15.00';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Session updated to MIXED (Singles + Breaks)';
  RAISE NOTICE 'Refresh the page to see inventory cost: $135.00';
  RAISE NOTICE '==================================================';
END $$;
