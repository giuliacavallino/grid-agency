-- Bewerbungen direkt über die Website: Formular mit Upload statt Mail an
-- hello@. Die Website schreibt als anon (wie das Kontaktformular): Dateien
-- in den Bucket „bewerbungen“, die Bewerbung über submit_application()
-- direkt als Karte in Personal → Bewerbungen.

-- Stellen: Texte stehen auf der Website (src/lib/content.ts) und sind immer
-- alle sichtbar und wählbar. active = „Wird gesucht“ (grüner Chip), Regler
-- in Personal → Stellen. Neue Stelle = Eintrag in content.ts plus Zeile mit
-- demselben slug.
create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique,
  title text not null,
  active boolean not null default true,
  position double precision not null default extract(epoch from now())
);

insert into public.job_postings (slug, title, position) values
  ('social-media-manager', 'Social Media Manager (w/m/d)', 1),
  ('video-content-creator', 'Video Content Creator / Videographer (w/m/d)', 2),
  ('werkstudent-social-media', 'Werkstudent (w/m/d) Social Media Marketing', 3),
  ('praktikum-social-media', 'Praktikum (w/m/d) Social Media Marketing', 4);

alter table public.job_postings enable row level security;
-- Die Website liest als anon, welche Stellen gerade gesucht werden
create policy job_postings_public_read on public.job_postings
  for select to anon using (true);

create trigger job_postings_touch before update on public.job_postings
  for each row execute function public.touch_updated_at();

-- Bewerbungen: Herkunft ('website'; aus der Mail erkennbar an mailbox) und
-- hochgeladene Unterlagen [{ path, name, type, size }]
alter table public.applications
  add column source text,
  add column job_slug text,
  add column link text,
  add column files jsonb not null default '[]'::jsonb;

-- Unterlagen: privat, nur PDF/Bilder/Word, höchstens 4 MB pro Datei.
-- anon darf nur hochladen (kein Lesen, Überschreiben oder Löschen).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bewerbungen', 'bewerbungen', false, 4194304,
  array[
    'application/pdf', 'image/jpeg', 'image/png',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy bewerbungen_upload on storage.objects
  for insert to anon with check (bucket_id = 'bewerbungen');

-- Bewerbung von der Website anlegen. security definer, weil applications
-- für anon gesperrt ist; Stelle, Phase und Herkunft setzt die Funktion.
create function public.submit_application(
  p_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_job_slug text,
  p_link text,
  p_message text,
  p_files jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_file jsonb;
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_email), '') = '' then
    raise exception 'Name und E-Mail fehlen';
  end if;
  if length(p_name) > 200 or length(p_email) > 200 or length(coalesce(p_phone, '')) > 60
    or length(coalesce(p_link, '')) > 500 or length(coalesce(p_message, '')) > 5000 then
    raise exception 'Eingabe zu lang';
  end if;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) not between 1 and 5 then
    raise exception 'Unterlagen fehlen';
  end if;
  -- Nur Dateien aus dem eigenen Upload-Ordner
  for v_file in select * from jsonb_array_elements(p_files) loop
    if coalesce(v_file ->> 'path', '') not like p_id::text || '/%' then
      raise exception 'Ungültige Datei';
    end if;
  end loop;

  if p_job_slug is not null then
    select title into v_title from public.job_postings where slug = p_job_slug;
  end if;

  insert into public.applications (
    source, source_ref, received_at, name, email, phone, job_slug, position_title, link, message,
    files, attachment_names
  ) values (
    'website', p_id::text, now(), trim(p_name), trim(p_email), nullif(trim(p_phone), ''),
    case when v_title is null then null else p_job_slug end,
    coalesce(v_title, 'Initiativbewerbung'),
    nullif(trim(p_link), ''), nullif(trim(p_message), ''),
    p_files,
    array(select f ->> 'name' from jsonb_array_elements(p_files) f)
  )
  on conflict (source_ref) do nothing;
end;
$$;
revoke execute on function public.submit_application(uuid, text, text, text, text, text, text, jsonb) from public, authenticated;
grant execute on function public.submit_application(uuid, text, text, text, text, text, text, jsonb) to anon;
