-- E-Book-Leadmagnet „Social Media 2027“ (Landingpage /ebook der Website):
-- Wer das E-Book anfordert, landet direkt als Lead in Sales → Pipeline.
-- Die Website schreibt als anon, daher security definer (wie
-- submit_application). Herkunft 'meta', wenn die Anfrage aus einer
-- Meta-Anzeige kommt (utm_source oder fbclid), sonst 'website'.
-- Pro E-Mail-Adresse nur ein Lead: Wer das E-Book zweimal anfordert,
-- bekommt es erneut, im CRM bleibt es bei einer Karte.
create function public.submit_ebook_lead(
  p_name text,
  p_email text,
  p_company text,
  p_from_meta boolean,
  p_tracking jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_email), '') = '' then
    raise exception 'Name und E-Mail fehlen';
  end if;
  if length(p_name) > 200 or length(p_email) > 200 or length(coalesce(p_company, '')) > 200
    or length(coalesce(p_tracking::text, '')) > 2000 then
    raise exception 'Eingabe zu lang';
  end if;

  insert into public.leads (source, source_ref, name, email, company, message, raw)
  values (
    case when p_from_meta then 'meta' else 'website' end,
    'ebook:' || lower(trim(p_email)),
    trim(p_name),
    trim(p_email),
    nullif(trim(p_company), ''),
    'Hat das E-Book „Social Media 2027“ heruntergeladen und der Kontaktaufnahme zugestimmt.',
    jsonb_build_object('ebook', 'social-media-2027', 'consent_at', now(), 'tracking', coalesce(p_tracking, '{}'::jsonb))
  )
  on conflict (source, source_ref) do nothing;
end;
$$;
revoke execute on function public.submit_ebook_lead(text, text, text, boolean, jsonb) from public, authenticated;
grant execute on function public.submit_ebook_lead(text, text, text, boolean, jsonb) to anon;
