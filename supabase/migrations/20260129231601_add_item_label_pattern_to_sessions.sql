-- Add item_label_pattern column to sessions table to store detected naming convention
-- Examples: "Item #", "Card #", "Slot #", etc.
alter table sessions add column item_label_pattern text;

-- Add a comment to explain the column
comment on column sessions.item_label_pattern is 'The naming pattern detected from imported CSV (e.g., "Item #", "Card #", "Slot #"). Used to display items consistently with the original naming convention.';
