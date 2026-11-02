-- Profilbild je Kunde (Aufgaben): aus Instagram (Meta Business Discovery)
-- oder hochgeladen. Das Bild liegt als Kopie im Storage, weil die Adressen
-- von Instagram nach kurzer Zeit ablaufen.
alter table public.task_projects add column if not exists instagram text;
alter table public.task_projects add column if not exists avatar_path text;
alter table public.task_projects add column if not exists avatar_source text check (avatar_source in ('instagram', 'upload'));
alter table public.task_projects add column if not exists avatar_updated_at timestamptz;
