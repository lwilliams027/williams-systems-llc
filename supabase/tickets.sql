-- =====================================================================
-- Williams Systems LLC — Tickets. Runs after crm.sql; safe to re-run.
--
--   public.tickets          A client's request: change, bug, question,
--                           feature. Files attached. Owners can add it to
--                           the contract's scope of work.
--   public.ticket_messages  The thread on a ticket (with files), plus
--                           system lines like status changes.
--   storage "ticket-files"  Private bucket, one folder per ticket.
--
-- Access model
--   Owners  : everything.
--   Clients : open tickets for themselves (on their own contracts), read
--             and reply on their tickets, attach files. The only thing a
--             client can change on a ticket afterwards is its files.
-- =====================================================================

create table if not exists public.tickets (
  id           uuid primary key default gen_random_uuid(),
  number       bigint generated always as identity unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  contract_id  uuid references public.contracts (id) on delete set null,
  client_id    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  title        text not null check (char_length(title) between 1 and 160),
  body         text check (char_length(body) <= 8000),
  kind         text not null default 'change' check (kind in ('change', 'bug', 'question', 'feature', 'other')),
  priority     text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  files        jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 20),
  sow_added_at timestamptz,
  resolved_at  timestamptz
);
create index if not exists tickets_client_idx on public.tickets (client_id, updated_at desc);
create index if not exists tickets_contract_idx on public.tickets (contract_id);
alter table public.tickets enable row level security;

create or replace function public.my_ticket(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tickets t where t.id = tid and t.client_id = auth.uid());
$$;
revoke all on function public.my_ticket(uuid) from public;
grant execute on function public.my_ticket(uuid) to authenticated;

-- storage paths look like "<ticket id>/<file>": may this person use that folder?
create or replace function public.can_use_ticket_path(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tickets t
                  where t.id::text = split_part(p, '/', 1)
                    and (t.client_id = auth.uid() or public.is_admin()));
$$;
revoke all on function public.can_use_ticket_path(text) from public;
grant execute on function public.can_use_ticket_path(text) to authenticated;

drop policy if exists "Owners manage tickets" on public.tickets;
create policy "Owners manage tickets" on public.tickets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Clients see their tickets" on public.tickets;
create policy "Clients see their tickets" on public.tickets
  for select to authenticated using (client_id = auth.uid());
drop policy if exists "Clients open tickets" on public.tickets;
create policy "Clients open tickets" on public.tickets
  for insert to authenticated
  with check (client_id = auth.uid() and created_by = auth.uid()
              and (contract_id is null or public.my_contract(contract_id)));
drop policy if exists "Clients attach files" on public.tickets;
create policy "Clients attach files" on public.tickets
  for update to authenticated using (client_id = auth.uid()) with check (client_id = auth.uid());

revoke all on public.tickets from anon, authenticated;
grant select, insert, update, delete on public.tickets to authenticated;

-- clients: fixed starting state on insert, and only files may change afterwards
create or replace function public.tickets_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.status = 'open'; new.sow_added_at = null; new.resolved_at = null;
      new.client_id = auth.uid(); new.created_by = auth.uid();
    elsif new.client_id is null and new.contract_id is not null then
      select c.client_id into new.client_id from public.contracts c where c.id = new.contract_id;
    end if;
    return new;
  end if;
  if not public.is_admin() then
    if (new.title, new.body, new.kind, new.priority, new.status, new.contract_id, new.client_id, new.sow_added_at)
       is distinct from (old.title, old.body, old.kind, old.priority, old.status, old.contract_id, old.client_id, old.sow_added_at) then
      raise exception 'Only files can be changed on a ticket' using errcode = '42501';
    end if;
  end if;
  new.updated_at = now();
  if new.status in ('resolved', 'closed') and old.status not in ('resolved', 'closed') then new.resolved_at = now(); end if;
  if new.status not in ('resolved', 'closed') then new.resolved_at = null; end if;
  return new;
end;
$$;
drop trigger if exists tickets_before on public.tickets;
create trigger tickets_before before insert or update on public.tickets
  for each row execute function public.tickets_before();

-- ---------- Thread ----------
create table if not exists public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  kind        text not null default 'message' check (kind in ('message', 'system')),
  sender_id   uuid references auth.users (id) on delete set null default auth.uid(),
  sender_name text,
  sender_role text,
  body        text not null default '' check (char_length(body) <= 4000),
  files       jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 10),
  created_at  timestamptz not null default now(),
  check (kind = 'system' or char_length(body) > 0 or jsonb_array_length(files) > 0)
);
create index if not exists ticket_messages_idx on public.ticket_messages (ticket_id, created_at);
alter table public.ticket_messages enable row level security;

drop policy if exists "Read your ticket threads" on public.ticket_messages;
create policy "Read your ticket threads" on public.ticket_messages
  for select to authenticated using (public.is_admin() or public.my_ticket(ticket_id));
drop policy if exists "Reply on your tickets" on public.ticket_messages;
create policy "Reply on your tickets" on public.ticket_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and (public.is_admin() or public.my_ticket(ticket_id)));
drop policy if exists "Owners delete ticket messages" on public.ticket_messages;
create policy "Owners delete ticket messages" on public.ticket_messages
  for delete to authenticated using (public.is_admin());

revoke all on public.ticket_messages from anon, authenticated;
grant select, delete on public.ticket_messages to authenticated;
grant insert (ticket_id, body, files) on public.ticket_messages to authenticated;

create or replace function public.stamp_ticket_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare p public.profiles;
begin
  if new.kind = 'system' then return new; end if;
  select * into p from public.profiles where id = auth.uid();
  new.sender_id = auth.uid();
  new.sender_name = coalesce(nullif(p.full_name, ''), p.email, 'Someone');
  new.sender_role = case when public.is_admin() then 'owner' else 'client' end;
  return new;
end;
$$;
drop trigger if exists ticket_messages_stamp on public.ticket_messages;
create trigger ticket_messages_stamp before insert on public.ticket_messages
  for each row execute function public.stamp_ticket_message();

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('ticket-files', 'ticket-files', false, 26214400) -- 25 MB per file
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "Upload to your tickets" on storage.objects;
create policy "Upload to your tickets" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ticket-files' and public.can_use_ticket_path(name));
drop policy if exists "Read your ticket files" on storage.objects;
create policy "Read your ticket files" on storage.objects
  for select to authenticated
  using (bucket_id = 'ticket-files' and public.can_use_ticket_path(name));
drop policy if exists "Owners delete ticket files" on storage.objects;
create policy "Owners delete ticket files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ticket-files' and public.is_admin());

-- ---------- Notifications can point at a ticket ----------
alter table public.notifications add column if not exists ticket_id uuid references public.tickets (id) on delete cascade;

create or replace function public.notify_ticket(uid uuid, owners boolean, k text, t text, b text, tk public.tickets)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, contract_id, ticket_id, target)
  select u, k, t, b, tk.contract_id, tk.id, 'ticket'
    from (select uid as u where not owners and uid is not null
          union select a.user_id from public.admins a where owners) x
   where u is distinct from auth.uid();
$$;
revoke all on function public.notify_ticket(uuid, boolean, text, text, text, public.tickets) from public, anon, authenticated;

create or replace function public.ticket_status_label(s text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case s when 'open' then 'Open' when 'in_progress' then 'In progress' when 'waiting' then 'Waiting on you'
                when 'resolved' then 'Resolved' when 'closed' then 'Closed' else s end;
$$;

create or replace function public.tickets_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare who text;
begin
  if tg_op = 'INSERT' then
    select coalesce(nullif(p.full_name, ''), p.email) into who from public.profiles p where p.id = new.client_id;
    perform public.notify_ticket(null, true, 'ticket', 'New ticket #' || new.number || ' · ' || new.title,
      coalesce(who, 'A client') || coalesce(' · ' || left(new.body, 120), ''), new);
    if public.is_admin() then
      perform public.notify_ticket(new.client_id, false, 'ticket', 'New ticket #' || new.number || ' · ' || new.title, 'Opened by Landon', new);
    end if;
    if new.contract_id is not null then
      insert into public.activity (contract_id, kind, summary) values (new.contract_id, 'ticket', 'Ticket #' || new.number || ' opened: ' || new.title);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.ticket_messages (ticket_id, kind, sender_role, body)
    values (new.id, 'system', 'system', 'Status: ' || public.ticket_status_label(old.status) || ' → ' || public.ticket_status_label(new.status));
    perform public.notify_ticket(new.client_id, false, 'status', 'Ticket #' || new.number || ' · ' || public.ticket_status_label(new.status), new.title, new);
  end if;
  if new.sow_added_at is not null and old.sow_added_at is null then
    insert into public.ticket_messages (ticket_id, kind, sender_role, body)
    values (new.id, 'system', 'system', 'Added to the scope of work');
    perform public.notify_ticket(new.client_id, false, 'deliverable', 'Ticket #' || new.number || ' was added to your scope of work', new.title, new);
    if new.contract_id is not null then
      insert into public.activity (contract_id, kind, summary) values (new.contract_id, 'scope', 'Added to scope from ticket #' || new.number || ': ' || new.title);
    end if;
  end if;
  -- (a ticket's own files are attached when it's opened and shown with the request;
  --  anything sent later travels on a message in the thread)
  return new;
end;
$$;
drop trigger if exists tickets_after on public.tickets;
create trigger tickets_after after insert or update on public.tickets
  for each row execute function public.tickets_after();

-- a reply tells the other side, and bumps the ticket
create or replace function public.ticket_message_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare t public.tickets;
begin
  if new.kind = 'system' then return new; end if;
  select * into t from public.tickets where id = new.ticket_id;
  -- a client answering a ticket that was waiting on them puts it back in the queue
  if new.sender_role = 'client' and t.status = 'waiting' then
    update public.tickets set status = 'open' where id = t.id;
  else
    update public.tickets set updated_at = now() where id = t.id;
  end if;
  if new.sender_role = 'owner' then
    perform public.notify_ticket(t.client_id, false, 'message', 'Reply on ticket #' || t.number || ' · ' || t.title,
      coalesce(nullif(left(new.body, 160), ''), 'Sent a file'), t);
  else
    perform public.notify_ticket(null, true, 'message', new.sender_name || ' · ticket #' || t.number,
      coalesce(nullif(left(new.body, 160), ''), 'Sent a file'), t);
  end if;
  return new;
end;
$$;
drop trigger if exists ticket_messages_after on public.ticket_messages;
create trigger ticket_messages_after after insert on public.ticket_messages
  for each row execute function public.ticket_message_after();

-- ---------- Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['tickets', 'ticket_messages'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
