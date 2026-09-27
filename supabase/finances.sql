-- =====================================================================
-- Williams Systems LLC — Finances: expenses (owners only) and a few
-- workspace-wide settings clients may read (e.g. the "manage payment
-- method" link). Safe to re-run.
-- =====================================================================

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  spent_on    date not null default current_date,
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null default 'other'
              check (category in ('software', 'hosting', 'contractor', 'equipment', 'marketing', 'fees', 'office', 'travel', 'other')),
  vendor      text check (char_length(vendor) <= 120),
  note        text check (char_length(note) <= 1000),
  contract_id uuid references public.contracts (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists expenses_spent_idx on public.expenses (spent_on desc);
alter table public.expenses enable row level security;
drop policy if exists "Owners manage expenses" on public.expenses;
create policy "Owners manage expenses" on public.expenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.expenses from anon, authenticated;
grant select, insert, update, delete on public.expenses to authenticated;

create table if not exists public.app_settings (
  key        text primary key check (char_length(key) <= 60),
  value      jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "Signed-in people read settings" on public.app_settings;
create policy "Signed-in people read settings" on public.app_settings
  for select to authenticated using (true);
drop policy if exists "Owners change settings" on public.app_settings;
create policy "Owners change settings" on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.app_settings from anon, authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;

-- ---------- Account hold ----------
-- Any bill left unpaid more than 60 days past its due date puts the
-- client's whole account on hold: no new tickets and no new meeting
-- requests until it's paid (messages still work, to sort it out).
create or replace function public.hold_days() returns int language sql immutable as $$ select 60 $$;

create or replace function public.client_on_hold(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (public.is_admin() or uid = auth.uid()) and exists (
    select 1 from public.invoices i join public.contracts c on c.id = i.contract_id
    where c.client_id = uid and i.status = 'sent'
      and coalesce(i.due_date, i.issued_at::date) < current_date - public.hold_days());
$$;
revoke all on function public.client_on_hold(uuid) from public;
grant execute on function public.client_on_hold(uuid) to authenticated;

create or replace function public.hold_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and public.client_on_hold(auth.uid()) then
    raise exception 'Your account is on hold for an unpaid balance more than 60 days past due. New work resumes once it''s paid.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists hold_guard on public.tickets;
create trigger hold_guard before insert on public.tickets for each row execute function public.hold_guard();
drop trigger if exists hold_guard on public.events;
create trigger hold_guard before insert on public.events for each row execute function public.hold_guard();
