-- Add item classification and ordering columns to inventory_items table

-- Add display_name column to store the original product name from CSV
alter table inventory_items add column display_name text;

-- Add normalized_key for grouping (lowercase normalized version)
alter table inventory_items add column normalized_key text;

-- Add bucket_type to classify items as "primary" or "givy"
alter table inventory_items add column bucket_type text check (bucket_type in ('primary', 'givy'));

-- Add item_index to store the extracted numeric value from product name
alter table inventory_items add column item_index integer;

-- Add comments to explain the columns
comment on column inventory_items.display_name is 'Original product name from CSV (e.g., "Product #12", "GIVY 7")';
comment on column inventory_items.normalized_key is 'Lowercase normalized version for grouping';
comment on column inventory_items.bucket_type is 'Item classification: "primary" for regular products, "givy" for giveaways/promos';
comment on column inventory_items.item_index is 'Extracted numeric value from product name for sorting';

-- Create index for efficient ordering
create index idx_inventory_items_ordering on inventory_items(session_id, bucket_type, item_index, card_number);
