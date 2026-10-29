-- Abgleich mit easybill: Kunden, Artikel (Positionen) und Retainer
-- (Serienrechnungen) tragen die easybill-ID, damit der Abgleich
-- wiederholbar ist und nichts doppelt anlegt.
alter table public.customers add column easybill_id bigint unique;
alter table public.articles add column easybill_id bigint unique;
alter table public.retainers add column easybill_id bigint unique;
