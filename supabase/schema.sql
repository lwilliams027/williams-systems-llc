-- =====================================================================
-- Williams Systems LLC — Supabase schema
-- Safe to run more than once (idempotent).
--
--   public.inquiries       Project inquiries from the website form.
--   public.inquiry_notes   Internal team notes on an inquiry (editable).
--   public.admins          Which auth users may use the team dashboard.
--   storage "inquiry-files" Private bucket for files attached to inquiries.
--
-- Access model
--   Visitors (anon)  : may INSERT an inquiry and UPLOAD files. Nothing else,
--                      not even reading back what they sent.
--   Admins           : read / update status / delete inquiries, read and
--                      delete files, full control of notes.
-- =====================================================================

-- ---------- Admins ----------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Inquiries ----------
create table if not exists public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 120),
  email      text not null check (char_length(email) <= 200 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  company    text check (char_length(company) <= 160),
  phone      text check (char_length(phone) <= 40),
  services   text[] not null default '{}' check (cardinality(services) <= 12),
  budget     text check (char_length(budget) <= 40),
  timeline   text check (char_length(timeline) <= 40),
  message    text not null check (char_length(message) between 1 and 5000),
  files      jsonb not null default '[]'::jsonb
             check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 10),
  status     text not null default 'new'
             check (status in ('new', 'in_progress', 'won', 'closed'))
);
create index if not exists inquiries_created_at_idx on public.inquiries (created_at desc);
alter table public.inquiries enable row level security;

drop trigger if exists inquiries_touch on public.inquiries;
create trigger inquiries_touch before update on public.inquiries
  for each row execute function public.touch_updated_at();

-- Column-level grants: visitors can only fill in the form fields
-- (not status / timestamps). Admins can only change status.
revoke all on public.inquiries from anon, authenticated;
grant insert (id, name, email, company, phone, services, budget, timeline, message, files)
  on public.inquiries to anon, authenticated;
grant select, delete on public.inquiries to authenticated;
grant update (status) on public.inquiries to authenticated;

drop policy if exists "Anyone can submit an inquiry" on public.inquiries;
create policy "Anyone can submit an inquiry" on public.inquiries
  for insert to anon, authenticated with check (status = 'new');

drop policy if exists "Admins can read inquiries" on public.inquiries;
create policy "Admins can read inquiries" on public.inquiries
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins can update inquiries" on public.inquiries;
create policy "Admins can update inquiries" on public.inquiries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete inquiries" on public.inquiries;
create policy "Admins can delete inquiries" on public.inquiries
  for delete to authenticated using (public.is_admin());

-- ---------- Notes ----------
create table if not exists public.inquiry_notes (
  id           uuid primary key default gen_random_uuid(),
  inquiry_id   uuid not null references public.inquiries (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 5000),
  author_email text default (auth.jwt() ->> 'email'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists inquiry_notes_inquiry_idx on public.inquiry_notes (inquiry_id, created_at);
alter table public.inquiry_notes enable row level security;

drop trigger if exists inquiry_notes_touch on public.inquiry_notes;
create trigger inquiry_notes_touch before update on public.inquiry_notes
  for each row execute function public.touch_updated_at();

revoke all on public.inquiry_notes from anon, authenticated;
grant select, insert, update, delete on public.inquiry_notes to authenticated;

drop policy if exists "Admins manage notes" on public.inquiry_notes;
create policy "Admins manage notes" on public.inquiry_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Storage: private bucket for attachments ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('inquiry-files', 'inquiry-files', false, 26214400) -- 25 MB per file
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "Anyone can upload inquiry files" on storage.objects;
create policy "Anyone can upload inquiry files" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'inquiry-files' and (storage.foldername(name))[1] = 'inquiries');

drop policy if exists "Admins can read inquiry files" on storage.objects;
create policy "Admins can read inquiry files" on storage.objects
  for select to authenticated
  using (bucket_id = 'inquiry-files' and public.is_admin());

drop policy if exists "Admins can delete inquiry files" on storage.objects;
create policy "Admins can delete inquiry files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'inquiry-files' and public.is_admin());

-- ---------- Realtime: new inquiries appear live in the dashboard ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inquiries'
  ) then
    alter publication supabase_realtime add table public.inquiries;
  end if;
end $$;

-- =====================================================================
-- Accounts: two tiers, invite only
--
--   public.profiles         One row per account: name and tier ('owner' or 'client').
--   public.invites          Who may create an account, and at which tier.
--   public.access_requests  "Request a spot" submissions from the login page.
--
-- Nobody can create an account unless their email has an open invite; a
-- trigger on auth.users enforces this for password sign-ups and Google alike.
-- Owners are also listed in public.admins (the team dashboard's check).
-- =====================================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text check (char_length(full_name) <= 120),
  role       text not null default 'client' check (role in ('owner', 'client')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;

drop policy if exists "See your own profile (owners see all)" on public.profiles;
create policy "See your own profile (owners see all)" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- names can be changed by their owner; the tier can't (column-level grant below)
drop policy if exists "Edit your own name" on public.profiles;
create policy "Edit your own name" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;
revoke all on function public.my_role() from public;
grant execute on function public.my_role() to authenticated;

-- ---------- Invites ----------
create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (char_length(email) between 3 and 200),
  role        text not null default 'client' check (role in ('owner', 'client')),
  token       uuid not null default gen_random_uuid() unique,
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists invites_one_open_per_email on public.invites (lower(email)) where accepted_at is null;
alter table public.invites enable row level security;
revoke all on public.invites from anon;

drop policy if exists "Owners manage invites" on public.invites;
create policy "Owners manage invites" on public.invites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- An invite link carries only its token; this tells the sign-up page which email
-- (and tier) it's for, and nothing else.
create or replace function public.invite_for_token(t uuid)
returns table (email text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.email, i.role from public.invites i where i.token = t and i.accepted_at is null;
$$;
revoke all on function public.invite_for_token(uuid) from public;
grant execute on function public.invite_for_token(uuid) to anon, authenticated;

-- ---------- Every new account needs an open invite ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
begin
  select * into inv from public.invites i
   where lower(i.email) = lower(new.email) and i.accepted_at is null
   order by i.created_at desc limit 1;
  if inv.id is null then
    raise exception 'invite_required: % has no invite', new.email using errcode = 'P0001';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
          inv.role)
  on conflict (id) do nothing;
  if inv.role = 'owner' then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  update public.invites set accepted_at = now() where id = inv.id;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Request a spot ----------
create table if not exists public.access_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  email      text not null check (char_length(email) between 3 and 200),
  company    text check (char_length(company) <= 160),
  message    text check (char_length(message) <= 2000),
  status     text not null default 'new' check (status in ('new', 'invited', 'declined')),
  created_at timestamptz not null default now()
);
alter table public.access_requests enable row level security;

drop policy if exists "Anyone can request a spot" on public.access_requests;
create policy "Anyone can request a spot" on public.access_requests
  for insert to anon, authenticated with check (status = 'new');
drop policy if exists "Owners read requests" on public.access_requests;
create policy "Owners read requests" on public.access_requests
  for select to authenticated using (public.is_admin());
drop policy if exists "Owners update requests" on public.access_requests;
create policy "Owners update requests" on public.access_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Owners delete requests" on public.access_requests;
create policy "Owners delete requests" on public.access_requests
  for delete to authenticated using (public.is_admin());

-- ---------- Explicit table access (works when "automatically expose new tables" is off) ----------
-- Row-level security above still decides which rows each person can touch.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

revoke all on public.invites from anon, authenticated;
grant select, insert, update, delete on public.invites to authenticated;

revoke all on public.access_requests from anon, authenticated;
grant insert (name, email, company, message) on public.access_requests to anon, authenticated;
grant select, update, delete on public.access_requests to authenticated;
