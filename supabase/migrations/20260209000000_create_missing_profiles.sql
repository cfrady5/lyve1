-- Create profiles for existing users who don't have one
-- This fixes users created before the trigger was in place

insert into public.profiles (id, email)
select
  au.id,
  au.email
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null;
