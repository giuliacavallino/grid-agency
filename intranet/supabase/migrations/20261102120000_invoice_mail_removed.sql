-- Erledigte Eingangsrechnungen: Zeitpunkt, an dem die Mail in Outlook nach
-- „Buchhaltung → Rechnungseingang“ verschoben wurde
alter table public.invoices add column if not exists mail_removed_at timestamptz;
