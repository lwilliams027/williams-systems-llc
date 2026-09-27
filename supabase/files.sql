-- =====================================================================
-- Williams Systems LLC — Project files. Runs after tickets.sql; safe to re-run.
--
--   public.project_files   Files shared on a project (any type: stylesheets,
--                          CSVs, PDFs, images, zips…), uploaded by the owner
--                          or the client from the project's Files tab.
--   storage "project-files" Private bucket, one folder per project.
--
-- Access model
--   Owners  : everything.
--   Clients : see and upload files on their own projects; remove the files
--             they uploaded themselves.
-- =====================================================================

create table if not exists public.project_files (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references public.contracts (id) on delete cascade,
  path          text not null unique,
  name          text not null check (char_length(name) between 1 and 255),
  size          bigint not null default 0 check (size >= 0),
  type          text,
  note          text check (char_length(note) <= 500),
  uploaded_by   uuid references auth.users (id) on delete set null default auth.uid(),
  uploader_name text,
  uploader_role text,
  created_at    timestamptz not null default now()
);
create index if not exists project_files_contract_idx on public.project_files (contract_id, created_at desc);
alter table public.project_files enable row level security;

drop policy if exists "Owners manage project files" on public.project_files;
create policy "Owners manage project files" on public.project_files
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Clients see their project files" on public.project_files;
create policy "Clients see their project files" on public.project_files
  for select to authenticated using (public.my_contract(contract_id));
drop policy if exists "Clients add project files" on public.project_files;
create policy "Clients add project files" on public.project_files
  for insert to authenticated with check (public.my_contract(contract_id) and uploaded_by = auth.uid());
drop policy if exists "Clients remove their own files" on public.project_files;
create policy "Clients remove their own files" on public.project_files
  for delete to authenticated using (uploaded_by = auth.uid() and public.my_contract(contract_id));

revoke all on public.project_files from anon, authenticated;
grant select, delete on public.project_files to authenticated;
grant insert (contract_id, path, name, size, type, note) on public.project_files to authenticated;
grant update (note) on public.project_files to authenticated;

-- who uploaded it, stamped by the database
create or replace function public.stamp_project_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  new.uploaded_by = auth.uid();
  new.uploader_name = coalesce(nullif(p.full_name, ''), p.email, 'Someone');
  new.uploader_role = case when public.is_admin() then 'owner' else 'client' end;
  return new;
end;
$$;
drop trigger if exists project_files_stamp on public.project_files;
create trigger project_files_stamp before insert on public.project_files
  for each row execute function public.stamp_project_file();

-- logged, and the other side hears about it
create or replace function public.project_file_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare c public.contracts;
begin
  select * into c from public.contracts where id = new.contract_id;
  insert into public.activity (contract_id, kind, summary) values (c.id, 'file', 'File added: ' || new.name);
  if new.uploader_role = 'owner' then
    perform public.notify_user(c.client_id, 'file', 'New file: ' || new.name, c.title, c.id, 'files');
  else
    perform public.notify_owners('file', new.uploader_name || ' added a file', new.name || ' · ' || c.title, c.id, 'files');
  end if;
  return new;
end;
$$;
drop trigger if exists project_files_after on public.project_files;
create trigger project_files_after after insert on public.project_files
  for each row execute function public.project_file_after();

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800) -- 50 MB per file
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- paths look like "<contract id>/<file>": may this person use that folder?
create or replace function public.can_use_project_path(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (select 1 from public.contracts c
                  where c.id::text = split_part(p, '/', 1) and c.client_id = auth.uid());
$$;
revoke all on function public.can_use_project_path(text) from public;
grant execute on function public.can_use_project_path(text) to authenticated;

drop policy if exists "Upload project files" on storage.objects;
create policy "Upload project files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-files' and public.can_use_project_path(name));
drop policy if exists "Read project files" on storage.objects;
create policy "Read project files" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-files' and public.can_use_project_path(name));
drop policy if exists "Remove project files" on storage.objects;
create policy "Remove project files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-files' and (public.is_admin() or (public.can_use_project_path(name) and owner = auth.uid())));

-- ---------- Realtime ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_files') then
    alter publication supabase_realtime add table public.project_files;
  end if;
end $$;
