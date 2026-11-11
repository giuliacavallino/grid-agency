-- Versendete Zahlungserinnerungen je Beleg: [{ at, to, by }]
alter table billing_documents add column if not exists reminders jsonb not null default '[]'::jsonb;
