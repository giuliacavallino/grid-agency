-- Kundenportal: Kund*innen sehen ihre Kundenwelt (Postingplan-Fortschritt,
-- eingeplante Posts) nur lesend. Anmeldung per Link an die freigeschaltete
-- Adresse; Links und Sitzungen liegen nur als SHA-256 in der Datenbank.
create table public.portal_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  name text,
  active boolean not null default true,
  created_by text,
  invited_at timestamptz,
  last_login_at timestamptz,
  unique (workspace_id, email)
);
create index portal_users_email_idx on public.portal_users (email) where active;

create table public.portal_tokens (
  token_hash text primary key,
  kind text not null check (kind in ('login', 'session')),
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index portal_tokens_expiry_idx on public.portal_tokens (expires_at);

alter table public.portal_users enable row level security;
alter table public.portal_tokens enable row level security;
