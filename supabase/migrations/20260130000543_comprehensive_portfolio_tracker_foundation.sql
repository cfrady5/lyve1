-- ================================================================
-- COMPREHENSIVE PORTFOLIO TRACKER FOUNDATION
-- Implements platform/fee engine, enhanced cost basis, needs review queue
-- ================================================================

-- ================================================================
-- 1. PLATFORMS & FEE CONFIGURATION
-- ================================================================

create table platforms (
  id uuid primary key default gen_random_uuid(),
  platform_key text unique not null,
  display_name text not null,
  fee_percent_default numeric(5,4) not null default 0.0800, -- 8%
  payment_processing_percent_default numeric(5,4) not null default 0.0290, -- 2.9%
  payment_processing_fixed_default numeric(10,2) not null default 0.30,
  per_order_fixed_fee_default numeric(10,2) not null default 0.00,
  shipping_label_cost_default numeric(10,2) not null default 0.00,
  sales_tax_handling text not null default 'platform_collects' check (sales_tax_handling in ('platform_collects', 'seller_collects', 'none')),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table platforms is 'Selling platforms with configurable fee structures';
comment on column platforms.platform_key is 'Unique identifier: whatnot, ebay, pwcc, goldin, instagram, other';
comment on column platforms.fee_percent_default is 'Platform commission as decimal (0.08 = 8%)';
comment on column platforms.payment_processing_percent_default is 'Payment processing percentage (0.029 = 2.9%)';
comment on column platforms.sales_tax_handling is 'Who handles sales tax: platform, seller, or none';

-- Seed platforms with realistic defaults
insert into platforms (platform_key, display_name, fee_percent_default, payment_processing_percent_default, payment_processing_fixed_default, per_order_fixed_fee_default, shipping_label_cost_default, sales_tax_handling, notes) values
  ('whatnot', 'Whatnot', 0.0800, 0.0290, 0.30, 0.00, 0.00, 'platform_collects', 'Live auction platform - 8% commission + 2.9% + $0.30 processing'),
  ('ebay', 'eBay', 0.1250, 0.0290, 0.30, 0.00, 0.00, 'platform_collects', 'Online marketplace - ~12.5% final value fee + payment processing'),
  ('pwcc', 'PWCC Marketplace', 0.1000, 0.0000, 0.00, 0.00, 0.00, 'platform_collects', 'Auction house - 10% buyer premium, no seller fee (simplified)'),
  ('goldin', 'Goldin Auctions', 0.0000, 0.0000, 0.00, 0.00, 0.00, 'platform_collects', 'Premium auction house - buyer premium model (simplified)'),
  ('instagram', 'Instagram/DM Sales', 0.0000, 0.0290, 0.30, 0.00, 0.00, 'seller_collects', 'Direct sales - PayPal/Venmo fees only'),
  ('other', 'Other Platform', 0.0000, 0.0000, 0.00, 0.00, 0.00, 'none', 'Custom platform - configure fees as needed');

create index idx_platforms_key on platforms(platform_key);
create index idx_platforms_active on platforms(is_active);

-- ================================================================
-- 2. ENHANCED COST BASIS COLUMNS
-- Add comprehensive cost tracking to inventory_items
-- ================================================================

alter table inventory_items add column if not exists purchase_price numeric(10,2) default 0.00;
alter table inventory_items add column if not exists purchase_tax numeric(10,2) default 0.00;
alter table inventory_items add column if not exists shipping_in numeric(10,2) default 0.00;
alter table inventory_items add column if not exists supplies_cost numeric(10,2) default 0.00;
alter table inventory_items add column if not exists grading_cost numeric(10,2) default 0.00;
alter table inventory_items add column if not exists other_costs numeric(10,2) default 0.00;

comment on column inventory_items.purchase_price is 'Purchase price of the item';
comment on column inventory_items.purchase_tax is 'Sales tax paid on purchase';
comment on column inventory_items.shipping_in is 'Shipping cost to receive item';
comment on column inventory_items.supplies_cost is 'Sleeves, top loaders, boxes, etc.';
comment on column inventory_items.grading_cost is 'PSA/BGS/SGC grading fees';
comment on column inventory_items.other_costs is 'Any other costs associated with item';

-- Total cost basis is the sum of all costs (maintain existing cost_basis for backward compatibility)
comment on column inventory_items.cost_basis is 'Legacy total cost basis - use cost stack columns for detailed tracking';

-- ================================================================
-- 3. PLATFORM TRACKING FOR SALES
-- Add platform reference to sale_items
-- ================================================================

alter table sale_items add column if not exists platform_id uuid references platforms(id);
alter table sale_items add column if not exists platform_key text;

-- Fee override columns (null = use platform defaults)
alter table sale_items add column if not exists fee_override_enabled boolean default false;
alter table sale_items add column if not exists fee_percent_override numeric(5,4);
alter table sale_items add column if not exists processing_percent_override numeric(5,4);
alter table sale_items add column if not exists processing_fixed_override numeric(10,2);
alter table sale_items add column if not exists per_order_fee_override numeric(10,2);

-- Additional transaction details
alter table sale_items add column if not exists shipping_out numeric(10,2) default 0.00;
alter table sale_items add column if not exists shipping_label_cost numeric(10,2) default 0.00;
alter table sale_items add column if not exists taxes_collected numeric(10,2) default 0.00;

comment on column sale_items.platform_id is 'Reference to platform this item was sold on';
comment on column sale_items.platform_key is 'Platform key for quick lookups (denormalized)';
comment on column sale_items.fee_override_enabled is 'Whether to use override fees instead of platform defaults';
comment on column sale_items.shipping_out is 'Cost to ship item to buyer';
comment on column sale_items.shipping_label_cost is 'Cost of shipping label';
comment on column sale_items.taxes_collected is 'Sales tax collected (if seller responsible)';

create index idx_sale_items_platform on sale_items(platform_id);
create index idx_sale_items_platform_key on sale_items(platform_key);

-- ================================================================
-- 4. NEEDS REVIEW QUEUE
-- Track items requiring attention
-- ================================================================

create table needs_review (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid references inventory_items(id) on delete cascade,
  sale_item_id uuid references sale_items(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  reason_code text not null check (reason_code in (
    'missing_slot',
    'duplicate_slot',
    'missing_costs',
    'missing_dates',
    'fee_anomaly',
    'negative_roi',
    'missing_platform',
    'allocation_needed',
    'other'
  )),
  reason_detail text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table needs_review is 'Queue of items needing manual review or correction';
comment on column needs_review.reason_code is 'Category of issue requiring review';
comment on column needs_review.priority is 'Issue priority: low, medium, high';
comment on column needs_review.status is 'Current status: pending, in_progress, resolved, dismissed';

create index idx_needs_review_user on needs_review(user_id);
create index idx_needs_review_status on needs_review(status);
create index idx_needs_review_priority on needs_review(priority);
create index idx_needs_review_reason on needs_review(reason_code);
create index idx_needs_review_inventory on needs_review(inventory_item_id);
create index idx_needs_review_sale on needs_review(sale_item_id);

-- ================================================================
-- 5. INVENTORY METADATA ENHANCEMENTS
-- Add fields for comprehensive tracking
-- ================================================================

alter table inventory_items add column if not exists acquisition_source text;
alter table inventory_items add column if not exists acquisition_date date;
alter table inventory_items add column if not exists listed_date date;
alter table inventory_items add column if not exists sold_date date;
alter table inventory_items add column if not exists listing_platform_id uuid references platforms(id);
alter table inventory_items add column if not exists listing_price numeric(10,2);
alter table inventory_items add column if not exists market_value numeric(10,2);
alter table inventory_items add column if not exists item_status text default 'unlisted' check (item_status in (
  'unlisted',
  'listed',
  'sold',
  'shipped',
  'grading',
  'hold'
));

-- Categorization for analytics
alter table inventory_items add column if not exists sport text;
alter table inventory_items add column if not exists player text;
alter table inventory_items add column if not exists set_name text;
alter table inventory_items add column if not exists grade text;
alter table inventory_items add column if not exists year integer;

comment on column inventory_items.acquisition_source is 'Where item was acquired: retail, auction, trade, etc.';
comment on column inventory_items.acquisition_date is 'Date item was acquired';
comment on column inventory_items.item_status is 'Current status: unlisted, listed, sold, shipped, grading, hold';
comment on column inventory_items.market_value is 'Current estimated market value';
comment on column inventory_items.listing_price is 'Current or last listing price';

create index idx_inventory_status on inventory_items(item_status);
create index idx_inventory_acquisition_source on inventory_items(acquisition_source);
create index idx_inventory_sport on inventory_items(sport);
create index idx_inventory_player on inventory_items(player);
create index idx_inventory_acquisition_date on inventory_items(acquisition_date);

-- ================================================================
-- 6. ROW LEVEL SECURITY
-- ================================================================

-- Enable RLS on new tables
alter table platforms enable row level security;
alter table needs_review enable row level security;

-- Platforms are globally readable, admin only for updates
create policy "Platforms are viewable by all users"
  on platforms for select
  to authenticated
  using (true);

create policy "Platform updates for admins only"
  on platforms for all
  to authenticated
  using (false); -- Admin role check would go here in production

-- Needs review items are user-scoped
create policy "Users can view their own needs review items"
  on needs_review for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own needs review items"
  on needs_review for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own needs review items"
  on needs_review for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own needs review items"
  on needs_review for delete
  to authenticated
  using (auth.uid() = user_id);

-- ================================================================
-- 7. HELPFUL VIEWS
-- ================================================================

-- Computed cost basis view
create or replace view inventory_items_with_total_cost as
select
  i.*,
  (coalesce(i.purchase_price, 0) +
   coalesce(i.purchase_tax, 0) +
   coalesce(i.shipping_in, 0) +
   coalesce(i.supplies_cost, 0) +
   coalesce(i.grading_cost, 0) +
   coalesce(i.other_costs, 0)) as computed_total_cost
from inventory_items i;

comment on view inventory_items_with_total_cost is 'Inventory items with computed total cost from cost stack';

-- ================================================================
-- 8. FUNCTIONS
-- ================================================================

-- Function to calculate fees for a sale
create or replace function calculate_sale_fees(
  p_sale_price numeric,
  p_platform_id uuid,
  p_fee_override_enabled boolean default false,
  p_fee_percent_override numeric default null,
  p_processing_percent_override numeric default null,
  p_processing_fixed_override numeric default null,
  p_per_order_fee_override numeric default null
)
returns table (
  commission numeric,
  processing_fee numeric,
  fixed_fees numeric,
  total_fees numeric
) as $$
declare
  v_fee_percent numeric;
  v_processing_percent numeric;
  v_processing_fixed numeric;
  v_per_order_fee numeric;
  v_commission numeric;
  v_processing numeric;
  v_fixed numeric;
  v_total numeric;
begin
  -- Get fee structure (use overrides if enabled, else platform defaults)
  if p_fee_override_enabled then
    v_fee_percent := coalesce(p_fee_percent_override, 0);
    v_processing_percent := coalesce(p_processing_percent_override, 0);
    v_processing_fixed := coalesce(p_processing_fixed_override, 0);
    v_per_order_fee := coalesce(p_per_order_fee_override, 0);
  else
    select
      fee_percent_default,
      payment_processing_percent_default,
      payment_processing_fixed_default,
      per_order_fixed_fee_default
    into
      v_fee_percent,
      v_processing_percent,
      v_processing_fixed,
      v_per_order_fee
    from platforms
    where id = p_platform_id;
  end if;

  -- Calculate fees
  v_commission := p_sale_price * v_fee_percent;
  v_processing := (p_sale_price * v_processing_percent) + v_processing_fixed;
  v_fixed := v_per_order_fee;
  v_total := v_commission + v_processing + v_fixed;

  return query select
    round(v_commission, 2),
    round(v_processing, 2),
    round(v_fixed, 2),
    round(v_total, 2);
end;
$$ language plpgsql stable;

comment on function calculate_sale_fees is 'Calculate platform fees for a sale with override support';
