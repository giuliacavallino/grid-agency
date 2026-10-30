-- Jour fixe: wiederkehrende Termine mit einem festen Raum unter
-- meet.grid-agency.de für die ganze Serie. Die Serie liegt als Serien-Master
-- im Outlook-Postfach (event_id, mailbox). Einzeltermine (Erstgespräch,
-- Kick-off, Bewerbung) lassen alle neuen Spalten leer und laufen wie bisher
-- 7 Tage nach ends_at ab.
alter table public.meetings
  -- Graph-Muster und -Bereich (pattern, range) der Serie; null = Einzeltermin
  add column if not exists recurrence jsonb,
  -- Raum gilt bis valid_until + 7 Tage; null = offen, bis die Serie endet
  add column if not exists valid_until timestamptz,
  -- Serien-Master in Outlook und das Postfach, in dem er liegt
  add column if not exists event_id text,
  add column if not exists mailbox text,
  -- Serie beendet (Raum ist dann nach valid_until + 7 Tagen zu)
  add column if not exists cancelled_at timestamptz;

create index if not exists meetings_series_customer on public.meetings (customer_id) where recurrence is not null;
