-- Eingang für Dateien, die nicht über die Oberfläche kommen (z. B. Logos, die
-- Claude oder ein Agent aus Unterlagen heraussucht). Das Intranet übernimmt
-- jede Zeile beim nächsten Laden der Kundenakten in den Storage und löscht sie.
create table if not exists public.media_imports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  target text not null default 'logo' check (target in ('logo', 'asset')),
  -- Logo-Variante (z. B. Hauptlogo) bzw. Art des Bildmaterials (Foto, Grafik, Icon)
  variant text not null default 'Hauptlogo',
  filename text not null default 'logo.png',
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  data bytea not null
);

alter table public.media_imports enable row level security;
