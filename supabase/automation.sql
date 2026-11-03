-- =====================================================================
-- Williams Systems LLC — Autopilot jobs. Runs after tickets.sql; safe to re-run.
--
--   public.automation_jobs  One per ticket. The autopilot server on the
--                           owner's PC (autopilot/server.mjs) writes it with
--                           the service key; the owner answers it from the
--                           email buttons on act.html.
--
-- Life of a job
--   queued → working → ready (30-minute window) → pushing → pushed
--                    ↘ no_change / failed / manual (no repo mapped)
--   The owner's decision: approve (push now), hold (stop the timer),
--   changes (re-run with a note), discard (throw the branch away).
--   Silence until `deadline` counts as approve.
-- =====================================================================

create table if not exists public.automation_jobs (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null unique references public.tickets (id) on delete cascade,
  status      text not null default 'queued'
              check (status in ('queued', 'working', 'ready', 'pushing', 'pushed', 'no_change', 'failed', 'manual', 'discarded')),
  decision    text check (decision in ('approve', 'hold', 'changes', 'discard')),
  note        text check (char_length(note) <= 4000),
  summary     text,
  details     jsonb not null default '{}'::jsonb,
  deadline    timestamptz,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists automation_jobs_status_idx on public.automation_jobs (status, updated_at desc);
alter table public.automation_jobs enable row level security;

drop policy if exists "Owners read jobs" on public.automation_jobs;
create policy "Owners read jobs" on public.automation_jobs
  for select to authenticated using (public.is_admin());
drop policy if exists "Owners decide jobs" on public.automation_jobs;
create policy "Owners decide jobs" on public.automation_jobs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.automation_jobs from anon, authenticated;
grant select on public.automation_jobs to authenticated;
grant update (decision, note) on public.automation_jobs to authenticated;

-- the autopilot server uses the service key (no personal access token): it reads
-- tickets/threads, sets ticket status, and owns its job rows. Nothing more.
grant usage on schema public to service_role;
grant select, insert, update on public.automation_jobs to service_role;
grant select on public.tickets, public.ticket_messages, public.contracts, public.profiles to service_role;
grant update (status) on public.tickets to service_role;

create or replace function public.automation_jobs_before()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.decision is distinct from old.decision and new.decision is not null then new.decided_at = now(); end if;
  return new;
end;
$$;
drop trigger if exists automation_jobs_before on public.automation_jobs;
create trigger automation_jobs_before before update on public.automation_jobs
  for each row execute function public.automation_jobs_before();
