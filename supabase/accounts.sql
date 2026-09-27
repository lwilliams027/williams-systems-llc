-- =====================================================================
-- Williams Systems LLC — client accounts (solo or group). Safe to re-run.
--
--   public.client_accounts  One per client: a person (solo) or a company /
--                           team (group). Projects belong to an account.
--   public.account_members  The people in an account, by email. Each gets an
--                           invite link; once they sign up they're linked
--                           and see every project on the account.
--
-- contracts.client_id stays as the account's main contact (the first to
-- join); access now comes from membership, via public.my_contract().
--
-- Sign-up needs the invite link: an email sign-up must carry the invite's
-- token, so knowing an invited email isn't enough to take the account.
-- That makes it safe to skip the confirmation email.
-- =====================================================================

create table if not exists public.client_accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 160),
  kind        text not null default 'solo' check (kind in ('solo', 'group')),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
alter table public.client_accounts enable row level security;

create table if not exists public.account_members (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.client_accounts (id) on delete cascade,
  email       text not null check (char_length(email) between 3 and 200),
  name        text check (char_length(name) <= 120),
  role        text not null default 'member' check (role in ('lead', 'member')),
  user_id     uuid references public.profiles (id) on delete set null,
  invite_id   uuid references public.invites (id) on delete set null,
  joined_at   timestamptz,
  created_at  timestamptz not null default now()
);
create unique index if not exists account_members_email on public.account_members (account_id, lower(email));
create index if not exists account_members_user on public.account_members (user_id);
alter table public.account_members enable row level security;

alter table public.contracts add column if not exists account_id uuid references public.client_accounts (id) on delete set null;
create index if not exists contracts_account_idx on public.contracts (account_id);

-- ---------- who can see a project ----------
create or replace function public.my_contract(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contracts c
     where c.id = cid
       and (c.client_id = auth.uid()
            or exists (select 1 from public.account_members m where m.account_id = c.account_id and m.user_id = auth.uid())));
$$;

create or replace function public.my_account(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.account_members m where m.account_id = aid and m.user_id = auth.uid());
$$;
revoke all on function public.my_account(uuid) from public;
grant execute on function public.my_account(uuid) to authenticated;

drop policy if exists "Clients see their contracts" on public.contracts;
create policy "Clients see their contracts" on public.contracts
  for select to authenticated using (status <> 'lost' and public.my_contract(id));

drop policy if exists "Owners manage accounts" on public.client_accounts;
create policy "Owners manage accounts" on public.client_accounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Members see their account" on public.client_accounts;
create policy "Members see their account" on public.client_accounts
  for select to authenticated using (public.my_account(id));

drop policy if exists "Owners manage members" on public.account_members;
create policy "Owners manage members" on public.account_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Members see their team" on public.account_members;
create policy "Members see their team" on public.account_members
  for select to authenticated using (public.my_account(account_id));

revoke all on public.client_accounts from anon, authenticated;
grant select, insert, update, delete on public.client_accounts to authenticated;
revoke all on public.account_members from anon, authenticated;
grant select, insert, update, delete on public.account_members to authenticated;

-- tickets on a shared project are shared by the whole team
create or replace function public.my_ticket(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tickets t
                  where t.id = tid and (t.client_id = auth.uid() or (t.contract_id is not null and public.my_contract(t.contract_id))));
$$;
create or replace function public.can_use_ticket_path(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (select 1 from public.tickets t
                  where t.id::text = split_part(p, '/', 1)
                    and (t.client_id = auth.uid() or (t.contract_id is not null and public.my_contract(t.contract_id))));
$$;
drop policy if exists "Clients see their tickets" on public.tickets;
create policy "Clients see their tickets" on public.tickets
  for select to authenticated using (client_id = auth.uid() or (contract_id is not null and public.my_contract(contract_id)));

create or replace function public.can_use_project_path(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (select 1 from public.contracts c
                  where c.id::text = split_part(p, '/', 1) and public.my_contract(c.id));
$$;

-- a hold covers everyone on the account
create or replace function public.client_on_hold(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (public.is_admin() or uid = auth.uid()) and exists (
    select 1 from public.invoices i join public.contracts c on c.id = i.contract_id
    where (c.client_id = uid or exists (select 1 from public.account_members m where m.account_id = c.account_id and m.user_id = uid))
      and i.status = 'sent'
      and coalesce(i.due_date, i.issued_at::date) < current_date - public.hold_days());
$$;

-- ---------- linking people to accounts ----------
-- adding someone who already has an account links them straight away
create or replace function public.account_members_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email = lower(trim(new.email));
  if new.user_id is null then
    select p.id into new.user_id from public.profiles p where lower(p.email) = new.email limit 1;
    if new.user_id is not null then new.joined_at = coalesce(new.joined_at, now()); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists account_members_before on public.account_members;
create trigger account_members_before before insert or update of email on public.account_members
  for each row execute function public.account_members_before();

-- the account's projects get a main contact as soon as someone is linked
create or replace function public.account_members_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    update public.contracts set client_id = new.user_id
     where account_id = new.account_id and client_id is null;
  end if;
  return new;
end;
$$;
drop trigger if exists account_members_after on public.account_members;
create trigger account_members_after after insert or update of user_id on public.account_members
  for each row execute function public.account_members_after();

-- a new sign-up joins every account that listed their email
create or replace function public.link_contracts_to_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_members set user_id = new.id, joined_at = now()
   where user_id is null and lower(email) = lower(new.email);
  update public.contracts set client_id = new.id
   where client_id is null and lower(client_email) = lower(new.email);
  return new;
end;
$$;

-- a project attached to an account picks up its main contact
create or replace function public.contracts_account_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_id is not null and new.client_id is null then
    select m.user_id into new.client_id from public.account_members m
     where m.account_id = new.account_id and m.user_id is not null
     order by (m.role = 'lead') desc, m.joined_at limit 1;
  end if;
  return new;
end;
$$;
drop trigger if exists contracts_account_link on public.contracts;
create trigger contracts_account_link before insert or update of account_id on public.contracts
  for each row execute function public.contracts_account_link();

-- notifications for a project's main contact go to the whole team
create or replace function public.notifications_fanout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contracts;
begin
  if new.contract_id is null then return new; end if;
  select * into c from public.contracts where id = new.contract_id;
  if c.account_id is null or c.client_id is distinct from new.user_id then return new; end if;
  insert into public.notifications (user_id, kind, title, body, contract_id, target, ticket_id)
  select m.user_id, new.kind, new.title, new.body, new.contract_id, new.target, new.ticket_id
    from public.account_members m
   where m.account_id = c.account_id and m.user_id is not null
     and m.user_id is distinct from new.user_id and m.user_id is distinct from auth.uid();
  return new;
end;
$$;
drop trigger if exists notifications_fanout on public.notifications;
create trigger notifications_fanout after insert on public.notifications
  for each row execute function public.notifications_fanout();

-- ---------- sign-up needs the invite link ----------
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

-- what the sign-up page shows: the email, the tier, and the account's name
drop function if exists public.invite_for_token(uuid);
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
   limit 1;
$$;
revoke all on function public.invite_for_token(uuid) from public;
grant execute on function public.invite_for_token(uuid) to anon, authenticated;

-- ---------- existing projects become solo accounts ----------
do $$
declare r record; aid uuid;
begin
  for r in select c.id, c.client_id, c.client_name, c.client_email, c.company, p.email as pemail, p.full_name
             from public.contracts c left join public.profiles p on p.id = c.client_id
            where c.account_id is null and (c.client_id is not null or c.client_email is not null) loop
    select m.account_id into aid from public.account_members m where lower(m.email) = lower(coalesce(r.pemail, r.client_email)) limit 1;
    if aid is null then
      insert into public.client_accounts (name, kind, created_by)
      values (coalesce(r.company, r.client_name, r.full_name, r.client_email, 'Client'), 'solo', null) returning id into aid;
      insert into public.account_members (account_id, email, name, role, user_id, joined_at)
      values (aid, lower(coalesce(r.pemail, r.client_email)), coalesce(r.client_name, r.full_name), 'lead', r.client_id, case when r.client_id is not null then now() end);
    end if;
    update public.contracts set account_id = aid where id = r.id;
  end loop;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'account_members') then
    alter publication supabase_realtime add table public.account_members;
  end if;
end $$;

-- ---------- Group chat ----------
-- Each person's "read up to" time per conversation, so a group chat can
-- show who has seen a message ("Seen by Jordan, Casey").
create table if not exists public.chat_reads (
  contract_id uuid not null references public.contracts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  read_at     timestamptz not null default now(),
  primary key (contract_id, user_id)
);
alter table public.chat_reads enable row level security;
drop policy if exists "See reads in your conversations" on public.chat_reads;
create policy "See reads in your conversations" on public.chat_reads
  for select to authenticated using (public.is_admin() or public.my_contract(contract_id));
drop policy if exists "Mark your own reads" on public.chat_reads;
create policy "Mark your own reads" on public.chat_reads
  for insert to authenticated with check (user_id = auth.uid() and (public.is_admin() or public.my_contract(contract_id)));
drop policy if exists "Move your own reads" on public.chat_reads;
create policy "Move your own reads" on public.chat_reads
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and (public.is_admin() or public.my_contract(contract_id)));
revoke all on public.chat_reads from anon, authenticated;
grant select, insert, update on public.chat_reads to authenticated;
insert into public.chat_reads (contract_id, user_id, read_at)
select m.contract_id, u.uid, max(m.created_at)
  from public.contract_messages m
  cross join lateral (select c.client_id as uid from public.contracts c where c.id = m.contract_id
                      union select a.user_id from public.admins a) u
 where u.uid is not null
 group by m.contract_id, u.uid
on conflict do nothing;

-- people on the account (and the owners) see each other's names in the chat
create or replace function public.is_teammate(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins x where x.user_id = pid)
      or exists (select 1 from public.account_members a join public.account_members b on a.account_id = b.account_id
                  where a.user_id = auth.uid() and b.user_id = pid);
$$;
revoke all on function public.is_teammate(uuid) from public;
grant execute on function public.is_teammate(uuid) to authenticated;
drop policy if exists "Teammates see each other" on public.profiles;
create policy "Teammates see each other" on public.profiles
  for select to authenticated using (public.is_teammate(id));

-- a message goes to everyone else in the conversation
create or replace function public.message_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare c public.contracts;
begin
  select * into c from public.contracts where id = new.contract_id;
  if new.sender_role <> 'owner' then
    perform public.notify_owners('message', new.sender_name || ' · ' || c.title, left(new.body, 160), c.id, 'contract');
  end if;
  insert into public.notifications (user_id, kind, title, body, contract_id, target)
  select distinct u.uid, 'message', 'New message from ' || new.sender_name, left(new.body, 160), c.id, 'contract'
    from (select c.client_id as uid
          union select m.user_id from public.account_members m where m.account_id = c.account_id) u
   where u.uid is not null and u.uid is distinct from new.sender_id;
  return new;
end;
$$;

-- messages already reach the whole team above; don't copy them twice
create or replace function public.notifications_fanout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contracts;
begin
  if new.contract_id is null or new.kind = 'message' then return new; end if;
  select * into c from public.contracts where id = new.contract_id;
  if c.account_id is null or c.client_id is distinct from new.user_id then return new; end if;
  insert into public.notifications (user_id, kind, title, body, contract_id, target, ticket_id)
  select m.user_id, new.kind, new.title, new.body, new.contract_id, new.target, new.ticket_id
    from public.account_members m
   where m.account_id = c.account_id and m.user_id is not null
     and m.user_id is distinct from new.user_id and m.user_id is distinct from auth.uid();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_reads') then
    alter publication supabase_realtime add table public.chat_reads;
  end if;
end $$;
