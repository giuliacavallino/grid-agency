-- Zeiterfassung in der Kopfleiste: Jede Zeile ist ein Zeitblock einer Person.
-- ended_at null = Timer läuft noch. Pro Person läuft höchstens ein Timer.
-- Zugriff nur über den Server (Service-Key), daher RLS ohne Policies.
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_email text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  customer_id uuid references public.customers (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  note text not null default '',
  constraint time_entries_range check (ended_at is null or ended_at > started_at),
  constraint time_entries_note_length check (char_length(note) <= 300)
);

create index if not exists time_entries_user_started
  on public.time_entries (user_email, started_at desc);

create unique index if not exists time_entries_one_running
  on public.time_entries (user_email) where ended_at is null;

alter table public.time_entries enable row level security;
