-- Wer das Intranet nutzen darf (Admin → Benutzer & Rechte): Microsoft-Konto
-- (E-Mail) plus Rolle. admin sieht alles inkl. Admin-Konsole, interne
-- Passwörter und Protokoll; member nur die Bereiche in areas. Konten, die
-- hier fehlen oder inaktiv sind, kommen nicht hinein.
create table public.intranet_users (
  email text primary key check (email = lower(email)),
  name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  areas text[] not null default '{aufgaben}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.intranet_users enable row level security;
create trigger intranet_users_touch before update on public.intranet_users
  for each row execute function public.touch_updated_at();
