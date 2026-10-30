-- Marketing Hub: Kundenwelten, verbundene Kanäle (Canva, LinkedIn, Meta,
-- TikTok) und Posts, die der Agent oder das Team plant und veröffentlicht.
-- Tokens liegen nur verschlüsselt (VAULT_KEY) in der Datenbank.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  kind text not null default 'customer' check (kind in ('agency', 'customer')),
  -- CI des Kunden (beim Onboarding gesetzt): Hauptfarbe, Zweitfarbe, Logo
  color text not null default '#afaaa0',
  secondary_color text,
  logo_path text,
  project_id uuid references public.task_projects (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  archived boolean not null default false,
  -- z. B. Canva-Ordner und SharePoint-Ordner der Kundenwelt
  settings jsonb not null default '{}'::jsonb
);

create unique index if not exists workspaces_one_agency on public.workspaces (kind) where kind = 'agency';

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('canva', 'linkedin', 'facebook', 'instagram', 'tiktok')),
  external_id text not null,
  name text not null,
  handle text,
  avatar_url text,
  token text,
  refresh_token text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'error')),
  error text,
  connected_by text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, external_id)
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'publishing', 'published', 'partial', 'failed')),
  caption text not null default '',
  -- [{ path, mime, kind: image|video, width?, height?, canva_design_id? }]
  media jsonb not null default '[]'::jsonb,
  account_ids uuid[] not null default '{}',
  scheduled_at timestamptz,
  published_at timestamptz,
  -- { [account_id]: { status, remote_id?, url?, error?, at } }
  results jsonb not null default '{}'::jsonb,
  created_by text
);

create index if not exists social_posts_due on public.social_posts (scheduled_at) where status = 'scheduled';
create index if not exists social_posts_workspace on public.social_posts (workspace_id, created_at desc);

create table if not exists public.oauth_states (
  state text primary key,
  provider text not null,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  verifier text,
  created_by text not null,
  -- wohin nach dem Login (Marketing Hub oder Kunden-Verbindungsseite)
  return_path text,
  expires_at timestamptz not null
);

-- Verbindungslinks für Kunden: Der Kunde öffnet den Link, meldet sich bei
-- Instagram/Facebook, LinkedIn oder TikTok an und erlaubt GRID das Posten.
-- Gespeichert wird nur der SHA-256 des Links, nicht der Link selbst.
create table if not exists public.connect_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token_hash text not null unique,
  created_by text not null,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  last_used_at timestamptz
);

alter table public.workspaces enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_posts enable row level security;
alter table public.oauth_states enable row level security;
alter table public.connect_links enable row level security;

-- Medien für Posts (exportierte Canva-Designs, Uploads). Privat; Meta und
-- TikTok holen sie über /api/social/media/… mit nicht erratbarem Pfad.
insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', false)
on conflict (id) do nothing;

-- Startbestand: GRID selbst und die aktiven Kunden aus Aufgaben
insert into public.workspaces (name, kind, color)
select 'GRID AGENCY', 'agency', '#141414'
where not exists (select 1 from public.workspaces where kind = 'agency');

insert into public.workspaces (name, kind, color, project_id)
select p.name, 'customer', p.color, p.id
from public.task_projects p
where not p.archived and not p.restricted
  and not exists (select 1 from public.workspaces w where w.project_id = p.id);

-- CI-Welt je Kunde als Vorgabe für Team und Agenten: Farben, Schriften,
-- Logo-Varianten, Tonalität, Zielgruppe, Bildsprache, Dos & Don'ts, Hashtags
alter table public.workspaces add column if not exists brand jsonb not null default '{}'::jsonb;
