-- Calls unter meet.grid-agency.de werden aufgezeichnet (nur Ton) und
-- transkribiert; aus dem Transkript schlägt Azure OpenAI Aufgaben vor, die
-- im Hub unter Aufgaben → Aus Calls freigegeben werden. Wer beitritt,
-- stimmt mit dem Klick auf „Jetzt beitreten“ zu (Hinweis unter dem Button).
-- Die Tonaufnahme wird nach dem Transkribieren bei Azure gelöscht.

-- Zuordnung des Raums: Lead (Erstgespräch, Kick-off), Kunde, Bewerbung
alter table public.meetings
  add column lead_id uuid references public.leads (id) on delete set null,
  add column customer_id uuid references public.customers (id) on delete set null,
  add column application_id uuid references public.applications (id) on delete set null,
  add column participants jsonb not null default '[]';

-- Eine Aufnahme je Anruf (serverCallId); ein Raum kann mehrere haben
create table public.meeting_recordings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  server_call_id text not null unique,
  recording_id text,
  status text not null default 'laeuft' check (status in ('laeuft', 'verarbeitung', 'fertig', 'fehler')),
  error text,
  duration_ms integer,
  -- Aufnahmedateien bei Azure (bis zur Auswertung, danach gelöscht)
  chunks jsonb,
  transcript jsonb,
  summary text,
  processed_at timestamptz
);
create index meeting_recordings_recent on public.meeting_recordings (created_at desc);
alter table public.meeting_recordings enable row level security;

-- Vorgeschlagene Aufgaben; übernommen werden sie zu normalen To-dos
create table public.meeting_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recording_id uuid not null references public.meeting_recordings (id) on delete cascade,
  title text not null,
  notes text,
  owner text not null default 'grid' check (owner in ('grid', 'kunde')),
  due_on date,
  status text not null default 'vorschlag' check (status in ('vorschlag', 'uebernommen', 'verworfen')),
  project_id uuid references public.task_projects (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  decided_by text,
  decided_at timestamptz,
  position double precision not null default extract(epoch from now())
);
create index meeting_tasks_open on public.meeting_tasks (status, created_at desc);
alter table public.meeting_tasks enable row level security;

-- Herkunft eines To-dos (für die Agents, die Aufgaben aus Calls abarbeiten)
alter table public.tasks
  add column meeting_task_id uuid references public.meeting_tasks (id) on delete set null;
