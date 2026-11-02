-- Ausgangsrechnungen nach dem Versand an DATEV (Rechnungsausgang, Upload per
-- Mail); je Beleg einmal, Fehler zum Nachholen durch den Serien-Cron.
alter table public.billing_documents
  add column if not exists datev_sent_at timestamptz,
  add column if not exists datev_error text;
