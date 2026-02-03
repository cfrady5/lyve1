-- Add card_number column to sale_items table to store the card number from CSV
alter table sale_items add column card_number integer;

-- Add index for faster matching queries
create index idx_sale_items_card_number on sale_items(card_number);
