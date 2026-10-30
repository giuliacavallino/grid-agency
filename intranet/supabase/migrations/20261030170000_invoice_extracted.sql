-- Wann der Beleg einer Eingangsrechnung ausgelesen wurde (Beträge,
-- Fälligkeit, bezahlt). Leer = noch auslesen.
alter table public.invoices add column extracted_at timestamptz;
