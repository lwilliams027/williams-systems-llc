-- =====================================================================
-- Williams Systems LLC — Account settings + invoices. Safe to re-run.
--
--   profiles: phone, company, prefs (customization + notification choices)
--   public.invoices: owners bill a project; clients see what's been sent
--                    and pay through the invoice's payment link.
-- =====================================================================

alter table public.profiles add column if not exists phone text check (char_length(phone) <= 40);
alter table public.profiles add column if not exists company text check (char_length(company) <= 160);
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object');
revoke update on public.profiles from authenticated;
grant update (full_name, phone, company, prefs) on public.profiles to authenticated;

-- ---------- Invoices ----------
create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  number      bigint generated always as identity unique,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  amount      numeric(12, 2) not null check (amount >= 0),
  status      text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  due_date    date,
  pay_link    text check (pay_link is null or (char_length(pay_link) <= 500 and pay_link ~* '^https://')),
  note        text check (char_length(note) <= 2000),
  issued_at   timestamptz,
  paid_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists invoices_contract_idx on public.invoices (contract_id, created_at desc);
alter table public.invoices enable row level security;

drop policy if exists "Owners manage invoices" on public.invoices;
create policy "Owners manage invoices" on public.invoices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Clients see their invoices" on public.invoices;
create policy "Clients see their invoices" on public.invoices
  for select to authenticated using (public.my_contract(contract_id) and status <> 'draft');

revoke all on public.invoices from anon, authenticated;
grant select, insert, update, delete on public.invoices to authenticated;

create or replace function public.invoices_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status in ('sent', 'paid') and new.issued_at is null then new.issued_at = now(); end if;
  if new.status = 'paid' then new.paid_at = coalesce(new.paid_at, now()); else new.paid_at = null; end if;
  return new;
end;
$$;
drop trigger if exists invoices_before on public.invoices;
create trigger invoices_before before insert or update on public.invoices
  for each row execute function public.invoices_before();

create or replace function public.invoices_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare c public.contracts;
begin
  select * into c from public.contracts where id = new.contract_id;
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') and (tg_op = 'INSERT' or old.status <> 'paid') then
    insert into public.activity (contract_id, kind, summary) values (c.id, 'invoice', 'Invoice #' || new.number || ' sent · $' || to_char(new.amount, 'FM999,999,990.00'));
    perform public.notify_user(c.client_id, 'invoice', 'New invoice: ' || new.title, '$' || to_char(new.amount, 'FM999,999,990.00') || coalesce(' · due ' || to_char(new.due_date, 'Mon FMDD'), ''), c.id, 'billing');
  elsif new.status = 'paid' and tg_op = 'UPDATE' and old.status is distinct from 'paid' then
    insert into public.activity (contract_id, kind, summary) values (c.id, 'invoice', 'Invoice #' || new.number || ' paid · $' || to_char(new.amount, 'FM999,999,990.00'));
    perform public.notify_user(c.client_id, 'invoice', 'Payment received: ' || new.title, 'Thank you!', c.id, 'billing');
  end if;
  return new;
end;
$$;
drop trigger if exists invoices_after on public.invoices;
create trigger invoices_after after insert or update on public.invoices
  for each row execute function public.invoices_after();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'invoices') then
    alter publication supabase_realtime add table public.invoices;
  end if;
end $$;
