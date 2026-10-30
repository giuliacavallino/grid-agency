-- Eigene Video-Calls unter meet.grid-agency.de (Azure Communication
-- Services) statt Teams: je Termin ein Raum, erreichbar über den kurzen Code
-- im Link. Wer den Link hat, kommt rein; nach Ablauf (7 Tage nach Ende) ist
-- der Raum zu. Nur der Server liest und schreibt (Service-Key).
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null unique,
  group_id uuid not null default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  host text,
  host_name text
);
alter table public.meetings enable row level security;
