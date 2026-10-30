-- Einladung zum Vorstellungsgespräch mit einem Klick aus Personal →
-- Bewerbungen: Mail von hello@ mit geheimem Link (nur dessen SHA-256 liegt
-- hier), Bewerber*in wählt einen freien Slot aus dem Outlook-Kalender der
-- einladenden Person, der Termin (Teams) wird dort angelegt. Ohne Einladung
-- gibt es keine Buchung.
alter table public.applications
  add column invite_token_hash text unique,
  add column invited_at timestamptz,
  add column invited_by text,
  add column invited_by_name text,
  add column interview_at timestamptz,
  add column interview_event_id text,
  add column interview_url text;
