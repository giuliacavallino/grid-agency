-- To-dos an den Agenten übergeben: Der Agent arbeitet sie mit den Werkzeugen
-- des Marketing Hubs ab (Recherche, Posts, Grafiken, Videos) und schreibt
-- Protokoll und Ergebnis an die Aufgabe.

alter table public.tasks
  add column if not exists agent_status text check (agent_status in ('queued', 'running', 'review', 'done', 'failed')),
  add column if not exists agent_log jsonb not null default '[]'::jsonb,
  add column if not exists agent_result text,
  add column if not exists agent_at timestamptz;

create index if not exists tasks_agent_queue on public.tasks (agent_at) where agent_status = 'queued';
