-- ================================================================
-- TEST DATA: Breaks Feature Demo
-- Creates a sample session with breaks to test the feature
-- ================================================================

-- Get or create a test user
DO $$
DECLARE
  v_user_id uuid;
  v_session_id uuid;
  v_break1_id uuid;
  v_break2_id uuid;
  v_break3_id uuid;
BEGIN
  -- Use the first user from auth.users, or create a placeholder
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Create a test user in auth.users (for local dev only)
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
      'authenticated',
      'authenticated',
      'demo@lyve.app',
      crypt('password123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      '',
      '',
      '',
      ''
    )
    ON CONFLICT (id) DO NOTHING;

    v_user_id := '11111111-1111-1111-1111-111111111111';
  END IF;

  RAISE NOTICE 'Using user ID: %', v_user_id;

  -- Create a test session
  INSERT INTO sessions (
    id,
    user_id,
    name,
    title,
    date,
    platform,
    status,
    show_type,
    estimated_fee_rate,
    profit_target_amount,
    created_at
  ) VALUES (
    'd22d6bfc-3dbc-48fd-a35c-aa20496ab048',
    v_user_id,
    'Breaks Demo Session',
    '2024 NFL Card Break Showcase',
    now(),
    'whatnot',
    'DRAFT',
    'breaks_only',
    0.12,
    200.00,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    show_type = 'breaks_only',
    title = '2024 NFL Card Break Showcase',
    updated_at = now()
  RETURNING id INTO v_session_id;

  RAISE NOTICE 'Created/Updated session: %', v_session_id;

  -- Add some session expenses
  INSERT INTO session_expenses (session_id, category, amount, description)
  VALUES
    (v_session_id, 'logistics_supplies', 25.00, 'Toploaders and sleeves'),
    (v_session_id, 'shipping_materials', 35.00, 'Shipping boxes and tape'),
    (v_session_id, 'promo', 15.00, 'Social media ads')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Added session expenses';

  -- ================================================================
  -- BREAK 1: Simple PYT Break
  -- ================================================================
  INSERT INTO breaks (
    id,
    session_id,
    title,
    break_style,
    break_type,
    box_cost,
    spot_count,
    teams_count,
    estimated_fee_rate,
    include_expenses_allocation,
    expenses_allocation_method,
    position,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_session_id,
    '2024 Prizm Football',
    'pyt',
    'single_product',
    150.00,
    30,
    30,
    NULL, -- Uses session default
    true,
    'pro_rata_cost',
    1,
    now()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_break1_id;

  RAISE NOTICE 'Created Break 1: Simple PYT (ID: %)', v_break1_id;

  -- ================================================================
  -- BREAK 2: Mixer Break with Multiple Boxes
  -- ================================================================
  INSERT INTO breaks (
    id,
    session_id,
    title,
    break_style,
    break_type,
    box_cost,
    spot_count,
    spot_config_type,
    teams_count,
    estimated_fee_rate,
    include_expenses_allocation,
    expenses_allocation_method,
    position,
    notes,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_session_id,
    'NFL Mixer Madness',
    'random_drafted',
    'mixer',
    0, -- Will be calculated from boxes
    30,
    'TEAM_30',
    30,
    NULL,
    true,
    'pro_rata_cost',
    2,
    'Mix of different products for variety',
    now()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_break2_id;

  RAISE NOTICE 'Created Break 2: Mixer (ID: %)', v_break2_id;

  -- Add boxes for the mixer break
  IF v_break2_id IS NOT NULL THEN
    INSERT INTO break_boxes (break_id, product_name, quantity, price_paid_per_box, position)
    VALUES
      (v_break2_id, 'Prizm Hobby', 2, 120.00, 0),
      (v_break2_id, 'Select Blaster', 1, 80.00, 1),
      (v_break2_id, 'Mosaic Cello', 3, 15.00, 2)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Added boxes to mixer break';
  END IF;

  -- ================================================================
  -- BREAK 3: PYP Break (Advanced)
  -- ================================================================
  INSERT INTO breaks (
    id,
    session_id,
    title,
    break_style,
    break_type,
    box_cost,
    spot_count,
    players_count,
    estimated_fee_rate,
    profit_target_amount,
    include_expenses_allocation,
    expenses_allocation_method,
    position,
    notes,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_session_id,
    'Elite Player Break',
    'pyp',
    'single_product',
    200.00,
    50,
    50,
    0.15, -- Custom 15% fee
    100.00, -- Custom $100 profit target
    true,
    'equal_per_break',
    3,
    'Premium player break with custom settings',
    now()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_break3_id;

  RAISE NOTICE 'Created Break 3: PYP (ID: %)', v_break3_id;

  -- ================================================================
  -- Summary
  -- ================================================================
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Test data created successfully!';
  RAISE NOTICE 'Session ID: %', v_session_id;
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Access the session at:';
  RAISE NOTICE 'http://localhost:3000/sessions/%', v_session_id;
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Session includes:';
  RAISE NOTICE '  - Session expenses: $75.00';
  RAISE NOTICE '  - Break 1: Simple PYT (30 teams)';
  RAISE NOTICE '  - Break 2: Mixer with 3 box types';
  RAISE NOTICE '  - Break 3: PYP with custom fee rate';
  RAISE NOTICE '==================================================';

END $$;
