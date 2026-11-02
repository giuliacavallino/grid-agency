-- Marketing Hub: Post-Vorschläge aus der Trend-Recherche (Claude + Websuche).
-- Aus einem Vorschlag wird per Klick oder per Autopilot ein Post im Kalender.

create table if not exists public.post_ideas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'used', 'dismissed')),
  provider text not null check (provider in ('linkedin', 'instagram', 'facebook', 'tiktok')),
  -- Thema, warum gerade relevant, Text, Hashtags, Grafik-Idee, Quellen
  title text not null,
  trend text not null default '',
  caption text not null default '',
  hashtags text[] not null default '{}',
  -- { headline, subline, format }
  visual jsonb not null default '{}'::jsonb,
  -- [{ title, url }]
  sources jsonb not null default '[]'::jsonb,
  post_id uuid references public.social_posts (id) on delete set null,
  created_by text
);

create index if not exists post_ideas_workspace on public.post_ideas (workspace_id, created_at desc);

alter table public.post_ideas enable row level security;
