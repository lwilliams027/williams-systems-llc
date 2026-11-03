-- =====================================================================
-- Security hardening (2026-11-02). Runs LAST, after stripe.sql.
-- Safe to re-run.
-- =====================================================================

-- ---------- public forms: no flooding ----------
-- anyone can send an inquiry or ask for a spot; cap how fast
create or replace function public.throttle_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare recent int; same int;
begin
  if public.is_admin() or auth.role() = 'service_role' then return new; end if;
  if tg_table_name = 'access_requests' then
    select count(*) into recent from public.access_requests where created_at > now() - interval '10 minutes';
    select count(*) into same from public.access_requests where lower(email) = lower(new.email) and created_at > now() - interval '1 day';
  else
    select count(*) into recent from public.inquiries where created_at > now() - interval '10 minutes';
    select count(*) into same from public.inquiries where lower(email) = lower(new.email) and created_at > now() - interval '1 hour';
  end if;
  if recent >= 15 or same >= 3 then
    raise exception 'rate_limited: too many requests, try again later' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.throttle_public() from public, anon, authenticated;
drop trigger if exists access_requests_throttle on public.access_requests;
create trigger access_requests_throttle before insert on public.access_requests
  for each row execute function public.throttle_public();
drop trigger if exists inquiries_throttle on public.inquiries;
create trigger inquiries_throttle before insert on public.inquiries
  for each row execute function public.throttle_public();

-- inquiry uploads (anyone can send them): 10 MB, everyday file types only.
-- No HTML/SVG/scripts, so nothing can open as a fake page.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array[
         'application/pdf', 'text/plain', 'text/csv', 'application/zip', 'application/x-zip-compressed',
         'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
         'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'video/mp4', 'video/quicktime']
 where id = 'inquiry-files';

-- at most 10 inquiry files per 10 minutes from the public
create or replace function public.throttle_inquiry_files()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.bucket_id <> 'inquiry-files' or public.is_admin() or auth.role() = 'service_role' then return new; end if;
  if (select count(*) from storage.objects
       where bucket_id = 'inquiry-files' and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'rate_limited: too many uploads, try again later' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.throttle_inquiry_files() from public, anon, authenticated;
drop trigger if exists inquiry_files_throttle on storage.objects;
create trigger inquiry_files_throttle before insert on storage.objects
  for each row execute function public.throttle_inquiry_files();

-- ---------- Stripe: only the owner (or the minute job) may ask ----------
create or replace function public.stripe_sync()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv record; s jsonb; paid int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then return 0; end if;   -- pg_cron has no auth.uid()
  if public.stripe_key() is null then return 0; end if;
  for inv in select id, stripe_link_id from public.invoices
              where status = 'sent' and stripe_link_id is not null
              order by due_date nulls last limit 40 loop
    begin
      select x into s
        from jsonb_array_elements(public.stripe_call('GET', 'checkout/sessions?limit=5&payment_link=' || inv.stripe_link_id) -> 'data') x
       where x ->> 'payment_status' = 'paid' limit 1;
      if s is not null then
        update public.invoices
           set status = 'paid', paid_via = 'stripe', stripe_payment_id = coalesce(s ->> 'payment_intent', s ->> 'id'),
               paid_at = to_timestamp((s ->> 'created')::bigint)
         where id = inv.id;
        paid := paid + 1;
      end if;
    exception when others then null;   -- one bad link doesn't stop the rest
    end;
  end loop;
  return paid;
end;
$$;
revoke all on function public.stripe_sync() from public, anon;
grant execute on function public.stripe_sync() to authenticated;

-- ---------- chat "typing" dots: private to the project ----------
drop policy if exists "Project people hear typing" on realtime.messages;
create policy "Project people hear typing" on realtime.messages
  for select to authenticated
  using (split_part(realtime.topic(), ':', 1) = 'typing'
         and (public.is_admin() or public.my_contract(nullif(split_part(realtime.topic(), ':', 2), '')::uuid)));
drop policy if exists "Project people send typing" on realtime.messages;
create policy "Project people send typing" on realtime.messages
  for insert to authenticated
  with check (split_part(realtime.topic(), ':', 1) = 'typing'
              and (public.is_admin() or public.my_contract(nullif(split_part(realtime.topic(), ':', 2), '')::uuid)));

-- ---------- logins: no switching your email to someone else's ----------
create or replace function public.block_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and current_user = 'supabase_auth_admin' then
    raise exception 'email_change_blocked: ask Williams Systems to change your email' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.block_email_change() from public, anon, authenticated;
drop trigger if exists auth_block_email_change on auth.users;
create trigger auth_block_email_change before update of email on auth.users
  for each row execute function public.block_email_change();

-- ---------- tickets: clients can't rewrite who/when ----------
create or replace function public.tickets_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- the autopilot (service key, see autopilot/server.mjs) acts for the owner
  if auth.role() = 'service_role' then
    new.updated_at = now();
    if tg_op = 'UPDATE' and new.status in ('resolved', 'closed') and old.status not in ('resolved', 'closed') then new.resolved_at = now(); end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.status = 'open'; new.sow_added_at = null; new.resolved_at = null;
      new.client_id = auth.uid(); new.created_by = auth.uid(); new.created_at = now();
    elsif new.client_id is null and new.contract_id is not null then
      select c.client_id into new.client_id from public.contracts c where c.id = new.contract_id;
    end if;
    return new;
  end if;
  if not public.is_admin() then
    if (new.title, new.body, new.kind, new.priority, new.status, new.contract_id, new.client_id, new.sow_added_at, new.created_by, new.created_at, new.resolved_at)
       is distinct from (old.title, old.body, old.kind, old.priority, old.status, old.contract_id, old.client_id, old.sow_added_at, old.created_by, old.created_at, old.resolved_at) then
      raise exception 'Only files can be changed on a ticket' using errcode = '42501';
    end if;
  end if;
  new.updated_at = now();
  if new.status in ('resolved', 'closed') and old.status not in ('resolved', 'closed') then new.resolved_at = now(); end if;
  if new.status not in ('resolved', 'closed') then new.resolved_at = null; end if;
  return new;
end;
$$;

-- ---------- project files: path and folder must belong to the project ----------
create or replace function public.stamp_project_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare p public.profiles;
begin
  if split_part(new.path, '/', 1) <> new.contract_id::text then
    raise exception 'File path must be inside its project' using errcode = '22023';
  end if;
  if new.folder_id is not null and not exists
     (select 1 from public.project_folders f where f.id = new.folder_id and f.contract_id = new.contract_id) then
    raise exception 'That folder belongs to another project' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then return new; end if;
  select * into p from public.profiles where id = auth.uid();
  new.uploaded_by = auth.uid();
  new.uploader_name = coalesce(nullif(p.full_name, ''), p.email, 'Someone');
  new.uploader_role = case when public.is_admin() then 'owner' else 'client' end;
  return new;
end;
$$;
drop trigger if exists project_files_stamp on public.project_files;
create trigger project_files_stamp before insert or update of path, folder_id, contract_id on public.project_files
  for each row execute function public.stamp_project_file();

-- ---------- settings: clients only see what their pages need ----------
drop policy if exists "Signed-in people read settings" on public.app_settings;
create policy "Signed-in people read settings" on public.app_settings
  for select to authenticated
  using (key in ('billing', 'stripe', 'site') or public.is_admin());

-- ---------- invites expire after 30 days ----------
alter table public.invites add column if not exists expires_at timestamptz;
alter table public.invites alter column expires_at set default now() + interval '30 days';
update public.invites set expires_at = greatest(created_at, now()) + interval '30 days'
 where expires_at is null and accepted_at is null;

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
     and (i.expires_at is null or i.expires_at > now())
   order by i.created_at desc limit 1;
  if inv.id is null then
    raise exception 'invite_required: % has no invite', new.email using errcode = 'P0001';
  end if;
  -- email + password sign-ups must come through the link (Google has already verified the email)
  if coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email'
     and coalesce(new.raw_user_meta_data ->> 'invite_token', '') <> inv.token::text then
    raise exception 'invite_link_required: use the invite link for %', new.email using errcode = 'P0001';
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

create or replace function public.invite_for_token(t uuid)
returns table (email text, role text, account text, kind text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.email, i.role, a.name, a.kind
    from public.invites i
    left join public.account_members m on m.invite_id = i.id
    left join public.client_accounts a on a.id = m.account_id
   where i.token = t and i.accepted_at is null
     and (i.expires_at is null or i.expires_at > now())
   limit 1;
$$;
revoke all on function public.invite_for_token(uuid) from public;
grant execute on function public.invite_for_token(uuid) to anon, authenticated;
