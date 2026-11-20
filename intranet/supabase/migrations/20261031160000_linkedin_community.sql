-- LinkedIn Community Management: Kommentare unter Posts der Unternehmensseiten
-- (abgerufen, vom Agenten beantwortet) und Outreach-Entwürfe (Nachrichten,
-- Kontaktanfragen), die das Team mit einem Klick auf LinkedIn abschickt.
-- LinkedIn erlaubt nur Personen-URNs zu speichern, keine Profildaten.

create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  account_id uuid not null references public.social_accounts (id) on delete cascade,
  -- Post (urn:li:share/ugcPost), Aktivität (urn:li:activity) und Kommentar
  post_urn text not null,
  object_urn text not null,
  comment_urn text not null,
  parent_urn text,
  author_urn text not null,
  text text not null default '',
  post_text text not null default '',
  commented_at timestamptz,
  -- new: offen · replied: beantwortet · skipped: bewusst ohne Antwort ·
  -- needs_human: Agent übergibt ans Team · failed: Antwort fehlgeschlagen ·
  -- own: eigener Kommentar · old: vor dem ersten Abruf (nicht beantworten)
  status text not null default 'new' check (status in ('new', 'replied', 'skipped', 'needs_human', 'failed', 'own', 'old')),
  reason text,
  reply_text text,
  reply_urn text,
  replied_by text,
  replied_at timestamptz,
  error text,
  unique (account_id, comment_urn)
);

create index if not exists social_comments_workspace on public.social_comments (workspace_id, commented_at desc);
create index if not exists social_comments_open on public.social_comments (status) where status = 'new';

create table if not exists public.social_outreach (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  account_id uuid references public.social_accounts (id) on delete set null,
  kind text not null check (kind in ('message', 'invitation')),
  recipient text not null,
  profile_url text not null,
  text text not null default '',
  context text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'discarded')),
  created_by text,
  sent_at timestamptz,
  sent_by text
);

create index if not exists social_outreach_workspace on public.social_outreach (workspace_id, status, created_at desc);

alter table public.social_comments enable row level security;
alter table public.social_outreach enable row level security;
