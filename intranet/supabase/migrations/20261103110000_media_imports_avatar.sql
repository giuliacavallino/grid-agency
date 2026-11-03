-- Profilbilder (wie bei Instagram) über den Datei-Eingang übernehmen
alter table public.media_imports drop constraint if exists media_imports_target_check;
alter table public.media_imports add constraint media_imports_target_check check (target in ('logo', 'asset', 'avatar'));
