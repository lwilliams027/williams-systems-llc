-- =====================================================================
-- Williams Systems LLC — Stripe, run from the database. Safe to re-run.
--
--   · The owner pastes the Stripe secret key in Settings → Business;
--     public.set_stripe_key() checks it with Stripe and keeps it in
--     Supabase Vault (encrypted). Nothing else can read it.
--   · A bill that goes out gets its own Stripe payment link for its
--     exact amount (trigger invoices_stripe). Paid / void bills retire it.
--   · public.stripe_sync() asks Stripe which links were paid and marks
--     those bills paid. pg_cron runs it every minute; pages call it too.
--
-- No webhook and no edge functions needed.
-- =====================================================================
create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

alter table public.invoices add column if not exists stripe_link_id text;
alter table public.invoices add column if not exists stripe_payment_id text;
alter table public.invoices add column if not exists paid_via text;
alter table public.invoices add column if not exists stripe_error text;

-- ---------- the key (Vault) ----------
create or replace function public.stripe_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'stripe_secret_key' limit 1;
$$;
revoke all on function public.stripe_key() from public, anon, authenticated;

-- one call to Stripe; raises with Stripe's own message on failure
create or replace function public.stripe_call(verb text, path text, body text default null, k text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r extensions.http_response;
  key text := coalesce(k, public.stripe_key());
begin
  if key is null then raise exception 'Stripe isn’t connected.'; end if;
  r := extensions.http((
    verb::extensions.http_method,
    'https://api.stripe.com/v1/' || path,
    array[extensions.http_header('Authorization', 'Bearer ' || key)],
    'application/x-www-form-urlencoded',
    body
  )::extensions.http_request);
  if r.status >= 300 then
    raise exception 'Stripe: %', coalesce(r.content::jsonb -> 'error' ->> 'message', 'error ' || r.status);
  end if;
  return r.content::jsonb;
end;
$$;
revoke all on function public.stripe_call(text, text, text, text) from public, anon, authenticated;

create or replace function public.stripe_enc(v text)
returns text
language sql
immutable
set search_path = ''
as $$ select extensions.urlencode(coalesce(v, '')) $$;

-- ---------- connect / disconnect (owners) ----------
create or replace function public.set_stripe_key(k text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct jsonb; info jsonb; sid uuid;
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  k := trim(k);
  if k !~ '^(sk|rk)_(test|live)_[A-Za-z0-9]+$' then
    raise exception 'That doesn’t look like a Stripe secret key. It starts with sk_test_ or sk_live_.';
  end if;
  acct := public.stripe_call('GET', 'account', null, k);   -- proves the key works
  select id into sid from vault.secrets where name = 'stripe_secret_key';
  if sid is null then perform vault.create_secret(k, 'stripe_secret_key', 'Stripe secret key for invoices');
  else perform vault.update_secret(sid, k); end if;
  info := jsonb_build_object(
    'connected', true,
    'mode', case when k like '%\_test\_%' then 'test' else 'live' end,
    'account', coalesce(acct #>> '{settings,dashboard,display_name}', acct #>> '{business_profile,name}', acct ->> 'email', acct ->> 'id'),
    'connectedAt', now());
  insert into public.app_settings (key, value, updated_at) values ('stripe', info, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return info;
end;
$$;
revoke all on function public.set_stripe_key(text) from public, anon;
grant execute on function public.set_stripe_key(text) to authenticated;

create or replace function public.disconnect_stripe()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  delete from vault.secrets where name = 'stripe_secret_key';
  delete from public.app_settings where key = 'stripe';
end;
$$;
revoke all on function public.disconnect_stripe() from public, anon;
grant execute on function public.disconnect_stripe() to authenticated;

-- ---------- payment links ----------
create or replace function public.stripe_make_link(inv public.invoices)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contracts;
  site text := coalesce((select value ->> 'url' from public.app_settings where key = 'site'), 'https://williamssystems.dev/');
  price jsonb; link jsonb; body text;
begin
  select * into c from public.contracts where id = inv.contract_id;
  price := public.stripe_call('POST', 'prices',
    'currency=usd&unit_amount=' || round(inv.amount * 100)::bigint
    || '&product_data[name]=' || public.stripe_enc(left(format('Invoice #%s · %s', inv.number, inv.title), 250))
    || '&product_data[metadata][invoice_id]=' || inv.id);
  body := 'line_items[0][price]=' || (price ->> 'id') || '&line_items[0][quantity]=1'
    || '&metadata[invoice_id]=' || inv.id
    || '&payment_intent_data[metadata][invoice_id]=' || inv.id
    || '&payment_intent_data[description]=' || public.stripe_enc(format('Williams Systems LLC · Invoice #%s%s', inv.number, coalesce(' · ' || c.title, '')))
    || '&restrictions[completed_sessions][limit]=1'
    -- custom development is a professional service, which Stripe's Managed Payments (merchant of record) doesn't cover
    || '&managed_payments[enabled]=false';
  if site like 'https://%' and c.id is not null then
    body := body || '&after_completion[type]=redirect&after_completion[redirect][url]='
      || public.stripe_enc(site || 'portal.html?paid=1#/' || coalesce(c.slug, c.id::text) || '/billing');
  else
    body := body || '&after_completion[type]=hosted_confirmation&after_completion[hosted_confirmation][custom_message]='
      || public.stripe_enc('Thank you! Your payment went through, and your bill will show as paid in your portal.');
  end if;
  link := public.stripe_call('POST', 'payment_links', body);
  return link;
end;
$$;
revoke all on function public.stripe_make_link(public.invoices) from public, anon, authenticated;

-- a bill going out gets a link; a new amount gets a new one; paid / void retire it
create or replace function public.invoices_stripe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  link jsonb;
  old_link text := case when tg_op = 'UPDATE' then old.stripe_link_id end;
begin
  if public.stripe_key() is null then return new; end if;
  begin
    -- retire the old link when the bill is settled or its amount changed
    if old_link is not null and (new.status in ('paid', 'void') or new.amount is distinct from old.amount or new.stripe_link_id is null) then
      perform public.stripe_call('POST', 'payment_links/' || old_link, 'active=false');
      if new.status <> 'paid' then
        if new.pay_link is not distinct from old.pay_link then new.pay_link := null; end if;
        new.stripe_link_id := null;
      end if;
    end if;
    -- a bill that's out, with no link of its own, gets a Stripe one
    if new.status = 'sent' and new.stripe_link_id is null and new.pay_link is null and new.amount >= 0.5 then
      link := public.stripe_make_link(new);
      new.pay_link := link ->> 'url';
      new.stripe_link_id := link ->> 'id';
    end if;
    new.stripe_error := null;
  exception when others then
    new.stripe_error := left(sqlerrm, 300);   -- the bill still saves; the dashboard shows why
  end;
  return new;
end;
$$;
drop trigger if exists invoices_stripe on public.invoices;
create trigger invoices_stripe before insert or update on public.invoices
  for each row execute function public.invoices_stripe();

-- ---------- who paid? ----------
create or replace function public.stripe_sync()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv record; s jsonb; paid int := 0;
begin
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

-- every minute
do $$
begin
  if exists (select 1 from cron.job where jobname = 'stripe-sync') then perform cron.unschedule('stripe-sync'); end if;
  perform cron.schedule('stripe-sync', '* * * * *', 'select public.stripe_sync()');
end $$;

-- where Stripe sends people back after paying
insert into public.app_settings (key, value) values ('site', '{"url": "https://lwilliams027.github.io/williams-systems-llc/"}')
on conflict (key) do nothing;
