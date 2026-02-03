-- Create storage bucket for sales report CSV files
insert into storage.buckets (id, name, public)
values ('sales-reports', 'sales-reports', true);

-- Allow users to upload sales reports to their own session folders
create policy "Users can upload sales reports"
on storage.objects for insert
with check (
  bucket_id = 'sales-reports'
  and exists (
    select 1 from sessions
    where sessions.id::text = (storage.foldername(name))[1]
    and sessions.user_id = auth.uid()
  )
);

-- Allow users to view their own sales reports
create policy "Users can view sales reports"
on storage.objects for select
using (
  bucket_id = 'sales-reports'
  and exists (
    select 1 from sessions
    where sessions.id::text = (storage.foldername(name))[1]
    and sessions.user_id = auth.uid()
  )
);

-- Allow users to delete their own sales reports
create policy "Users can delete sales reports"
on storage.objects for delete
using (
  bucket_id = 'sales-reports'
  and exists (
    select 1 from sessions
    where sessions.id::text = (storage.foldername(name))[1]
    and sessions.user_id = auth.uid()
  )
);
