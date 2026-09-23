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
