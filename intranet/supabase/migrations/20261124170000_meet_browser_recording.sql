-- Aufnahme im Browser statt ACS Call Recording: Ein Teilnehmer-Browser
-- schneidet den Ton des Calls mit (eigenes Mikro + alle anderen) und lädt ihn
-- alle 30 Sekunden hoch. Kein Azure Event Grid mehr nötig.
-- recorder: Segment, das gerade aufnimmt (Browser-Sitzung); fällt es aus,
-- übernimmt ein anderer Browser. Dateien liegen bis zur Auswertung im
-- privaten Bucket meet-audio unter <id>/<segment>/<index>.
alter table public.meeting_recordings
  add column if not exists source text not null default 'acs' check (source in ('acs', 'browser')),
  add column if not exists recorder text,
  add column if not exists parts integer not null default 0,
  add column if not exists last_chunk_at timestamptz;
create index if not exists meeting_recordings_open on public.meeting_recordings (status, last_chunk_at) where status = 'laeuft';

insert into storage.buckets (id, name, public) values ('meet-audio', 'meet-audio', false) on conflict (id) do nothing;

-- ACS-Aufnahmen, deren Datei Azure nie gemeldet hat, sind nicht mehr abrufbar
update public.meeting_recordings
set status = 'fehler', error = 'Aufnahme nicht abrufbar: Azure hat die Datei nie gemeldet.'
where source = 'acs' and status = 'laeuft' and created_at < now() - interval '1 hour';
