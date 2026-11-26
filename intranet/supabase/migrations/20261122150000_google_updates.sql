-- Wochen-Updates der Google-Betreuung je Kundenakte: Entwürfe (Montags-Cron
-- oder von Hand in Outlook gespeichert) und gesendete Mails. „Gute
-- Nachrichten“ im nächsten Update = seit dem letzten gesendeten erledigt.
create table public.google_updates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null check (status in ('draft', 'sent')),
  sent_at timestamptz,
  subject text not null,
  "to" text[] not null default '{}',
  cc text[] not null default '{}',
  html text not null,
  mailbox text,
  sent_by text
);
create index google_updates_workspace_idx on public.google_updates (workspace_id, created_at desc);
alter table public.google_updates enable row level security;
