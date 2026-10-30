-- Pipeline mit vier Spalten: Neuer Lead → Erstgespräch → Angebot verschickt
-- → Kunde gewonnen. Leads buchen das Erstgespräch selbst auf der Website
-- (mit oder ohne Einladungslink), das Angebot geht als Unterschriftsmappe
-- raus, die Unterschrift schiebt den Lead auf „gewonnen“, von dort startet
-- das Onboarding (Aufgaben, Serienrechnung, Kick-off-Termin).

update public.leads set stage = 'neu' where stage = 'eingeladen';
alter table public.leads drop constraint if exists leads_stage_check;
alter table public.leads add constraint leads_stage_check check (stage in ('neu', 'erstgespraech', 'angebot', 'gewonnen'));

alter table public.leads
  -- Einladung zum Erstgespräch (nur der SHA-256 des Links liegt hier)
  add column invite_token_hash text unique,
  add column invited_at timestamptz,
  add column invited_by text,
  -- Gebuchtes Erstgespräch
  add column meeting_at timestamptz,
  add column meeting_event_id text,
  add column meeting_url text,
  -- Angebot (Unterschriftsmappe) und Onboarding
  add column offer_id uuid references public.billing_documents (id) on delete set null,
  add column onboarding_at timestamptz,
  add column kickoff_token_hash text unique,
  add column kickoff_at timestamptz,
  add column kickoff_event_id text,
  add column kickoff_url text;

create index leads_offer_idx on public.leads (offer_id);

-- Captcha (ALTCHA): jede gelöste Aufgabe gilt nur einmal
create table public.altcha_used (
  signature text primary key,
  expires_at timestamptz not null
);
alter table public.altcha_used enable row level security;
