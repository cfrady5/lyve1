-- Drop existing restrictive policies
drop policy if exists "Users can upload sales reports" on storage.objects;
drop policy if exists "Users can view sales reports" on storage.objects;
drop policy if exists "Users can delete sales reports" on storage.objects;

drop policy if exists "Users can upload inventory images" on storage.objects;
drop policy if exists "Users can view inventory images" on storage.objects;
drop policy if exists "Users can delete inventory images" on storage.objects;

-- Create simpler policies for authenticated users
-- Sales reports bucket
create policy "Authenticated users can upload to sales-reports"
on storage.objects for insert
with check (
  bucket_id = 'sales-reports'
  and auth.role() = 'authenticated'
);

create policy "Authenticated users can view sales-reports"
on storage.objects for select
using (
  bucket_id = 'sales-reports'
  and auth.role() = 'authenticated'
);

create policy "Authenticated users can delete from sales-reports"
on storage.objects for delete
using (
  bucket_id = 'sales-reports'
  and auth.role() = 'authenticated'
);

-- Inventory images bucket
create policy "Authenticated users can upload to inventory-images"
on storage.objects for insert
with check (
  bucket_id = 'inventory-images'
  and auth.role() = 'authenticated'
);

create policy "Authenticated users can view inventory-images"
on storage.objects for select
using (
  bucket_id = 'inventory-images'
  and auth.role() = 'authenticated'
);

create policy "Authenticated users can delete from inventory-images"
on storage.objects for delete
using (
  bucket_id = 'inventory-images'
  and auth.role() = 'authenticated'
);
