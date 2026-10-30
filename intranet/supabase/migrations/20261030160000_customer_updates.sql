-- Absenderin für Kunden-Updates (Admin → Absender & Updates): je Kunde der
-- Teams-Chat und welche Updates automatisch rausgehen, plus Versandprotokoll.
alter table public.task_projects
  add column teams_chat_id text,
  add column teams_chat_title text,
  add column weekly_update boolean not null default false,
  add column monthly_report boolean not null default false;

create table public.customer_updates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.task_projects (id) on delete cascade,
  kind text not null check (kind in ('weekly', 'monthly')),
  period text not null,
  chat_id text,
  text text,
  status text not null check (status in ('sent', 'failed', 'skipped', 'preview')),
  error text,
  sent_by text
);
create unique index customer_updates_once on public.customer_updates (project_id, kind, period) where status = 'sent';
create index customer_updates_recent on public.customer_updates (created_at desc);
alter table public.customer_updates enable row level security;
