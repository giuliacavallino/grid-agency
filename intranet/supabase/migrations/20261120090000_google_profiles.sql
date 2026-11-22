-- Google-Betreuung je Kundenakte: Unternehmensprofile (Standorte) mit Status
-- und Bewertungen, dazu To-dos mit Zuständigkeit. Das Kundenportal liest
-- denselben Stand ohne interne Notizen. Zugriff nur über den Service-Key.
create table public.google_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  brand text,
  address text,
  maps_url text,
  status text not null default 'anlage' check (status in ('anlage', 'zugriff', 'nachweis', 'verifizierung', 'pruefung', 'live', 'gesperrt', 'archiviert')),
  rating numeric(2, 1) check (rating between 1 and 5),
  reviews integer check (reviews >= 0),
  rating_at date,
  start_rating numeric(2, 1) check (start_rating between 1 and 5),
  start_reviews integer check (start_reviews >= 0),
  note text,
  internal_note text,
  sort integer not null default 0
);
create index google_locations_workspace_idx on public.google_locations (workspace_id, sort);

create table public.google_todos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  location_id uuid references public.google_locations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  owner text not null default 'grid' check (owner in ('grid', 'kunde', 'google')),
  status text not null default 'offen' check (status in ('offen', 'in_arbeit', 'wartet', 'erledigt')),
  due date,
  note text,
  internal_note text,
  visible boolean not null default true,
  done_at timestamptz,
  created_by text,
  sort integer not null default 0
);
create index google_todos_workspace_idx on public.google_todos (workspace_id, status);

alter table public.google_locations enable row level security;
alter table public.google_todos enable row level security;
