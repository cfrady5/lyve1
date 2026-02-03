-- Bartr v1 Database Schema
-- Initial schema for inventory tracking and sales matching

-- Extends Supabase auth.users with additional profile data
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table profiles enable row level security;

-- Users can only read/update their own profile
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- A session represents a stream or collection event
create table sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

alter table sessions enable row level security;

create policy "Users can view own sessions"
  on sessions for select
  using (auth.uid() = user_id);

create policy "Users can create own sessions"
  on sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on sessions for delete
  using (auth.uid() = user_id);

-- Uploaded sales reports (CSV files)
create table sales_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  session_id uuid references sessions(id) on delete cascade not null,
  file_name text not null,
  file_url text, -- Supabase Storage URL for the CSV
  uploaded_at timestamptz default now()
);

alter table sales_reports enable row level security;

create policy "Users can view own sales reports"
  on sales_reports for select
  using (auth.uid() = user_id);

create policy "Users can create own sales reports"
  on sales_reports for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own sales reports"
  on sales_reports for delete
  using (auth.uid() = user_id);

-- Individual sale records parsed from CSV
create table sale_items (
  id uuid default gen_random_uuid() primary key,
  sales_report_id uuid references sales_reports(id) on delete cascade not null,
  row_number integer not null, -- for sequence matching (1, 2, 3...)
  item_title text,
  sale_price decimal(10,2) not null,
  fees decimal(10,2) default 0,
  created_at timestamptz default now(),
  unique(sales_report_id, row_number)
);

alter table sale_items enable row level security;

create policy "Users can view sale items from own reports"
  on sale_items for select
  using (
    exists (
      select 1 from sales_reports
      where sales_reports.id = sale_items.sales_report_id
      and sales_reports.user_id = auth.uid()
    )
  );

create policy "Users can create sale items for own reports"
  on sale_items for insert
  with check (
    exists (
      select 1 from sales_reports
      where sales_reports.id = sale_items.sales_report_id
      and sales_reports.user_id = auth.uid()
    )
  );

create policy "Users can delete sale items from own reports"
  on sale_items for delete
  using (
    exists (
      select 1 from sales_reports
      where sales_reports.id = sale_items.sales_report_id
      and sales_reports.user_id = auth.uid()
    )
  );

-- Individual inventory items (cards) with cost basis
create table inventory_items (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade not null,
  card_number integer not null, -- for "Card 1", "Card 2", etc. (1, 2, 3...)
  image_url text, -- Supabase Storage URL
  cost_basis decimal(10,2) not null,
  sale_item_id uuid references sale_items(id) on delete set null,
  match_type text check (match_type in ('auto', 'manual')),
  created_at timestamptz default now(),
  unique(session_id, card_number)
);

alter table inventory_items enable row level security;

create policy "Users can view inventory from own sessions"
  on inventory_items for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = inventory_items.session_id
      and sessions.user_id = auth.uid()
    )
  );

create policy "Users can create inventory in own sessions"
  on inventory_items for insert
  with check (
    exists (
      select 1 from sessions
      where sessions.id = inventory_items.session_id
      and sessions.user_id = auth.uid()
    )
  );

create policy "Users can update inventory in own sessions"
  on inventory_items for update
  using (
    exists (
      select 1 from sessions
      where sessions.id = inventory_items.session_id
      and sessions.user_id = auth.uid()
    )
  );

create policy "Users can delete inventory from own sessions"
  on inventory_items for delete
  using (
    exists (
      select 1 from sessions
      where sessions.id = inventory_items.session_id
      and sessions.user_id = auth.uid()
    )
  );

-- Indexes for common queries
create index idx_sessions_user on sessions(user_id);
create index idx_inventory_items_session on inventory_items(session_id);
create index idx_sales_reports_user on sales_reports(user_id);
create index idx_sales_reports_session on sales_reports(session_id);
create index idx_sale_items_report on sale_items(sales_report_id);

-- Function to auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Trigger to create profile when user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
