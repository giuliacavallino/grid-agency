-- Chat im Video-Call (meet.grid-agency.de): Nachrichten je Raum. Angezeigt
-- werden nur die der letzten 12 Stunden (bei Jour fixe also nur der laufende
-- Termin). Zugriff nur über den Server (Code aus dem Link).
create table public.meeting_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  name text not null,
  text text not null check (char_length(text) between 1 and 2000)
);
create index meeting_messages_room_idx on public.meeting_messages (meeting_id, created_at);
alter table public.meeting_messages enable row level security;
