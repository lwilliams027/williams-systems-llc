-- =====================================================================
-- Williams Systems LLC — CRM: contracts, chat, calendar, activity log,
-- and notifications. Runs after schema.sql; safe to run more than once.
--
--   public.contracts          Every deal, from proposal to complete. "Pending"
--                             is proposal / negotiating / awaiting_signature;
--                             "live" is active / on_hold.
--   public.contract_messages  The chat on a contract, between owner and client.
--   public.events             The calendar: meetings, calls, deadlines, payments.
--   public.activity           What happened, written only by triggers.
--   public.notifications      The bell. One row per person per thing.
--
-- Access model
--   Owners  : everything.
--   Clients : read their own contracts (by client_id), chat on them, read
--             their events, activity, and notifications. They can't edit a
--             contract or see anyone else's.
-- =====================================================================

-- ---------- Contracts ----------
create table if not exists public.contracts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  title        text not null check (char_length(title) between 1 and 160),
  client_id    uuid references public.profiles (id) on delete set null,
  client_name  text check (char_length(client_name) <= 120),
  client_email text check (char_length(client_email) <= 200),
  company      text check (char_length(company) <= 160),
  status       text not null default 'proposal'
               check (status in ('proposal', 'negotiating', 'awaiting_signature', 'active', 'on_hold', 'complete', 'lost')),
  value        numeric(12, 2) not null default 0 check (value >= 0),
  billing      text not null default 'one_time' check (billing in ('one_time', 'monthly')),
  progress     int not null default 0 check (progress between 0 and 100),
  start_date   date,
  due_date     date,
  scope        text check (char_length(scope) <= 20000),
  deliverables jsonb not null default '[]'::jsonb check (jsonb_typeof(deliverables) = 'array'),
  inquiry_id   uuid references public.inquiries (id) on delete set null,
  request_id   uuid references public.access_requests (id) on delete set null,
  signed_at    timestamptz,
  closed_at    timestamptz
);
create index if not exists contracts_client_idx on public.contracts (client_id);
create index if not exists contracts_status_idx on public.contracts (status);
alter table public.contracts enable row level security;

-- Is this contract mine (as the client)?
create or replace function public.my_contract(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.contracts c where c.id = cid and c.client_id = auth.uid());
$$;
revoke all on function public.my_contract(uuid) from public;
grant execute on function public.my_contract(uuid) to authenticated;

drop policy if exists "Owners manage contracts" on public.contracts;
create policy "Owners manage contracts" on public.contracts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Clients see their contracts" on public.contracts;
create policy "Clients see their contracts" on public.contracts
  for select to authenticated using (client_id = auth.uid() and status <> 'lost');

revoke all on public.contracts from anon, authenticated;
grant select, insert, update, delete on public.contracts to authenticated;

-- ---------- Chat ----------
create table if not exists public.contract_messages (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  sender_id   uuid references auth.users (id) on delete set null default auth.uid(),
  sender_name text,
  sender_role text,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists contract_messages_idx on public.contract_messages (contract_id, created_at);
alter table public.contract_messages enable row level security;

drop policy if exists "Read the chat on your contracts" on public.contract_messages;
create policy "Read the chat on your contracts" on public.contract_messages
  for select to authenticated using (public.is_admin() or public.my_contract(contract_id));
drop policy if exists "Write on your contracts" on public.contract_messages;
create policy "Write on your contracts" on public.contract_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and (public.is_admin() or public.my_contract(contract_id)));
drop policy if exists "Owners delete messages" on public.contract_messages;
create policy "Owners delete messages" on public.contract_messages
  for delete to authenticated using (public.is_admin());

revoke all on public.contract_messages from anon, authenticated;
grant select, delete on public.contract_messages to authenticated;
grant insert (contract_id, body) on public.contract_messages to authenticated;

-- who sent it, stamped by the database so nobody can pose as someone else
create or replace function public.stamp_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  new.sender_id = auth.uid();
  new.sender_name = coalesce(nullif(p.full_name, ''), p.email, 'Someone');
  new.sender_role = case when public.is_admin() then 'owner' else 'client' end;
  return new;
end;
$$;
drop trigger if exists contract_messages_stamp on public.contract_messages;
create trigger contract_messages_stamp before insert on public.contract_messages
  for each row execute function public.stamp_message();

-- ---------- Calendar ----------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 160),
  kind        text not null default 'meeting'
              check (kind in ('meeting', 'call', 'deadline', 'milestone', 'payment', 'task', 'note')),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean not null default false,
  contract_id uuid references public.contracts (id) on delete cascade,
  notes       text check (char_length(notes) <= 4000),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists events_starts_idx on public.events (starts_at);
alter table public.events enable row level security;

drop policy if exists "Owners manage events" on public.events;
create policy "Owners manage events" on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Clients see events on their contracts" on public.events;
create policy "Clients see events on their contracts" on public.events
  for select to authenticated using (contract_id is not null and public.my_contract(contract_id));

revoke all on public.events from anon, authenticated;
grant select, insert, update, delete on public.events to authenticated;

-- ---------- Activity log ----------
create table if not exists public.activity (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  contract_id uuid references public.contracts (id) on delete cascade,
  kind        text not null,
  summary     text not null,
  actor_id    uuid references auth.users (id) on delete set null default auth.uid()
);
create index if not exists activity_created_idx on public.activity (created_at desc);
create index if not exists activity_contract_idx on public.activity (contract_id, created_at desc);
alter table public.activity enable row level security;

drop policy if exists "Owners read activity" on public.activity;
create policy "Owners read activity" on public.activity
  for select to authenticated using (public.is_admin());
drop policy if exists "Clients read activity on their contracts" on public.activity;
create policy "Clients read activity on their contracts" on public.activity
  for select to authenticated using (contract_id is not null and public.my_contract(contract_id));

revoke all on public.activity from anon, authenticated;
grant select on public.activity to authenticated;

-- ---------- Notifications ----------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  contract_id uuid references public.contracts (id) on delete cascade,
  target      text,                      -- where a click goes: contract, requests, accounts, calendar
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists "See your notifications" on public.notifications;
create policy "See your notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Mark your notifications read" on public.notifications;
create policy "Mark your notifications read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Clear your notifications" on public.notifications;
create policy "Clear your notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify_owners(k text, t text, b text, cid uuid, tgt text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, contract_id, target)
  select a.user_id, k, t, b, cid, tgt from public.admins a
   where a.user_id is distinct from auth.uid();
$$;
create or replace function public.notify_user(uid uuid, k text, t text, b text, cid uuid, tgt text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, contract_id, target)
  select uid, k, t, b, cid, tgt where uid is not null and uid is distinct from auth.uid();
$$;
revoke all on function public.notify_owners(text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.notify_user(uuid, text, text, text, uuid, text) from public, anon, authenticated;

-- ---------- What triggers what ----------
create or replace function public.status_label(s text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case s
    when 'proposal' then 'Proposal'
    when 'negotiating' then 'Negotiating'
    when 'awaiting_signature' then 'Awaiting signature'
    when 'active' then 'Active'
    when 'on_hold' then 'On hold'
    when 'complete' then 'Complete'
    when 'lost' then 'Lost'
    else s end;
$$;

-- before insert/update: link the client account by email, stamp dates
create or replace function public.contracts_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.client_id is null and new.client_email is not null then
    select p.id into new.client_id from public.profiles p where lower(p.email) = lower(new.client_email) limit 1;
  end if;
  if new.status in ('active', 'on_hold', 'complete') and new.signed_at is null then
    new.signed_at = now();
    if new.start_date is null then new.start_date = current_date; end if;
  end if;
  if new.status in ('complete', 'lost') then
    new.closed_at = coalesce(new.closed_at, now());
    if new.status = 'complete' then new.progress = 100; end if;
  else
    new.closed_at = null;
  end if;
  return new;
end;
$$;
drop trigger if exists contracts_before on public.contracts;
create trigger contracts_before before insert or update on public.contracts
  for each row execute function public.contracts_before();

create or replace function public.contracts_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare item text;
begin
  if tg_op = 'INSERT' then
    insert into public.activity (contract_id, kind, summary)
    values (new.id, 'created', 'Contract created · ' || public.status_label(new.status));
    if new.status <> 'lost' then
      perform public.notify_user(new.client_id, 'contract', 'Your project page is ready', new.title, new.id, 'contract');
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.activity (contract_id, kind, summary)
    values (new.id, 'status', 'Status: ' || public.status_label(old.status) || ' → ' || public.status_label(new.status));
    if new.status <> 'lost' then
      perform public.notify_user(new.client_id, 'status', new.title || ' is now ' || lower(public.status_label(new.status)), null, new.id, 'contract');
    end if;
  end if;
  if new.client_id is not null and old.client_id is null and new.status <> 'lost' then
    perform public.notify_user(new.client_id, 'contract', 'Your project page is ready', new.title, new.id, 'contract');
  end if;
  if new.progress is distinct from old.progress and new.status <> 'complete' then
    insert into public.activity (contract_id, kind, summary) values (new.id, 'progress', 'Progress: ' || new.progress || '%');
  end if;
  if new.scope is distinct from old.scope then
    insert into public.activity (contract_id, kind, summary) values (new.id, 'scope', 'Scope of work updated');
  end if;
  if new.due_date is distinct from old.due_date then
    insert into public.activity (contract_id, kind, summary)
    values (new.id, 'dates', coalesce('Due date set to ' || to_char(new.due_date, 'Mon FMDD, YYYY'), 'Due date cleared'));
  end if;
  if new.value is distinct from old.value or new.billing is distinct from old.billing then
    insert into public.activity (contract_id, kind, summary) values (new.id, 'value', 'Price updated');
  end if;
  for item in
    select d ->> 'text' from jsonb_array_elements(new.deliverables) d
     where coalesce((d ->> 'done')::boolean, false)
       and not exists (select 1 from jsonb_array_elements(old.deliverables) o
                        where o ->> 'text' = d ->> 'text' and coalesce((o ->> 'done')::boolean, false))
  loop
    insert into public.activity (contract_id, kind, summary) values (new.id, 'deliverable', 'Finished: ' || item);
    perform public.notify_user(new.client_id, 'deliverable', 'Finished: ' || item, new.title, new.id, 'contract');
  end loop;
  return new;
end;
$$;
drop trigger if exists contracts_after on public.contracts;
create trigger contracts_after after insert or update on public.contracts
  for each row execute function public.contracts_after();

-- a new chat message tells the other side
create or replace function public.message_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare c public.contracts;
begin
  select * into c from public.contracts where id = new.contract_id;
  if new.sender_role = 'owner' then
    perform public.notify_user(c.client_id, 'message', 'New message from ' || new.sender_name, left(new.body, 160), c.id, 'contract');
  else
    perform public.notify_owners('message', new.sender_name || ' · ' || c.title, left(new.body, 160), c.id, 'contract');
  end if;
  return new;
end;
$$;
drop trigger if exists contract_messages_after on public.contract_messages;
create trigger contract_messages_after after insert on public.contract_messages
  for each row execute function public.message_after();

-- a scheduled event on a contract: logged, and the client hears about it
create or replace function public.event_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare c public.contracts;
begin
  if new.contract_id is null then return new; end if;
  select * into c from public.contracts where id = new.contract_id;
  insert into public.activity (contract_id, kind, summary)
  values (c.id, 'event', 'Scheduled: ' || new.title || ' · ' || to_char(new.starts_at at time zone 'America/Detroit', 'Mon FMDD'));
  perform public.notify_user(c.client_id, 'event', 'Scheduled: ' || new.title,
    to_char(new.starts_at at time zone 'America/Detroit', 'Dy, Mon FMDD') || case when new.all_day then '' else to_char(new.starts_at at time zone 'America/Detroit', ' · FMHH12:MI AM') end,
    c.id, 'contract');
  return new;
end;
$$;
drop trigger if exists events_after on public.events;
create trigger events_after after insert on public.events
  for each row execute function public.event_after();

-- new requests reach the owners' bell
create or replace function public.inquiry_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_owners('inquiry', 'New project inquiry · ' || new.name, left(new.message, 160), null, 'requests');
  return new;
end;
$$;
drop trigger if exists inquiries_notify on public.inquiries;
create trigger inquiries_notify after insert on public.inquiries
  for each row execute function public.inquiry_after();

create or replace function public.access_request_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_owners('request', 'Account request · ' || new.name, coalesce(new.company || ' · ', '') || new.email, null, 'accounts');
  return new;
end;
$$;
drop trigger if exists access_requests_notify on public.access_requests;
create trigger access_requests_notify after insert on public.access_requests
  for each row execute function public.access_request_after();

-- a client who signs up later gets linked to contracts already made for their email
create or replace function public.link_contracts_to_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.contracts set client_id = new.id
   where client_id is null and lower(client_email) = lower(new.email);
  return new;
end;
$$;
drop trigger if exists profiles_link_contracts on public.profiles;
create trigger profiles_link_contracts after insert on public.profiles
  for each row execute function public.link_contracts_to_profile();

-- ---------- Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['contracts', 'contract_messages', 'events', 'activity', 'notifications', 'access_requests'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
