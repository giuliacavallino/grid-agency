-- Passwort-Tresor (Admin → Passwörter): Zugänge je Kunde (project_id aus
-- Aufgaben) oder intern (nur Geschäftsführung). Das Passwort liegt nur
-- verschlüsselt in secret (AES-256-GCM, Schlüssel VAULT_KEY in Vercel);
-- die Datenbank sieht es nie im Klartext. vault_log hält fest, wer welches
-- Passwort angezeigt, kopiert oder geändert hat.
create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid references public.task_projects (id) on delete set null,
  internal boolean not null default false,
  title text not null,
  username text,
  secret text,
  url text,
  notes text,
  created_by text,
  updated_by text
);
create index vault_items_project_idx on public.vault_items (project_id);

create table public.vault_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  item_id uuid references public.vault_items (id) on delete set null,
  item_title text,
  user_email text not null,
  action text not null
);
create index vault_log_item_idx on public.vault_log (item_id, at desc);

alter table public.vault_items enable row level security;
alter table public.vault_log enable row level security;

create trigger vault_items_touch before update on public.vault_items
  for each row execute function public.touch_updated_at();
