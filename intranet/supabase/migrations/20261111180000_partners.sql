-- Netzwerk: Freelancer (Foto, Video, Schnitt, Grafik …) und Partner
-- (Catering, Food, Location, Druck …), mit Konditionen und Projekten.
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null default 'freelancer' check (kind in ('freelancer', 'partner')),
  category text not null default 'Sonstiges',
  name text not null,
  company text,
  email text,
  phone text,
  website text,
  instagram text,
  city text,
  focus text,
  rate numeric(12, 2),
  rate_unit text check (rate_unit in ('stunde', 'tag', 'halbtag', 'projekt', 'monat', 'pauschal')),
  rate_note text,
  rating smallint check (rating between 1 and 5),
  status text not null default 'aktiv' check (status in ('aktiv', 'pausiert', 'nicht_mehr')),
  projects text,
  notes text,
  last_contact date,
  source text,
  lead_id uuid references public.leads (id) on delete set null
);
create index partners_kind_idx on public.partners (kind, category, name);
alter table public.partners enable row level security;
create trigger partners_touch before update on public.partners
  for each row execute function public.touch_updated_at();
