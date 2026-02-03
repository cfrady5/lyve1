-- Create storage bucket for inventory images
insert into storage.buckets (id, name, public)
values ('inventory-images', 'inventory-images', true);

-- Allow users to upload images to their own session folders
create policy "Users can upload inventory images"
on storage.objects for insert
with check (
  bucket_id = 'inventory-images'
  and auth.uid()::text = (storage.foldername(name))[1]
  or exists (
    select 1 from sessions
    where sessions.id::text = (storage.foldername(name))[1]
    and sessions.user_id = auth.uid()
  )
);

-- Allow users to view images from their own sessions
create policy "Users can view inventory images"
on storage.objects for select
using (
  bucket_id = 'inventory-images'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or exists (
      select 1 from sessions
      where sessions.id::text = (storage.foldername(name))[1]
      and sessions.user_id = auth.uid()
    )
  )
);

-- Allow users to delete their own inventory images
create policy "Users can delete inventory images"
on storage.objects for delete
using (
  bucket_id = 'inventory-images'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or exists (
      select 1 from sessions
      where sessions.id::text = (storage.foldername(name))[1]
      and sessions.user_id = auth.uid()
    )
  )
);
