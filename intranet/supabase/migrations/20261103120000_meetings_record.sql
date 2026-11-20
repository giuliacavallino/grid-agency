-- Aufzeichnen pro Raum: beim Anlegen eines Termins abwählbar (Standard: an)
alter table public.meetings add column if not exists record boolean not null default true;
