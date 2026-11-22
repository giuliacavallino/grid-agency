-- Kontaktformular der Website fragt in Schritt 2 die Handynummer ab (Pflicht
-- auf der Website). Sie landet in contact_submissions und per Trigger im Lead.
alter table public.contact_submissions add column if not exists phone text;

create or replace function public.contact_submission_to_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.spam_senders s where s.email = lower(trim(new.email))) then
    return new;
  end if;
  insert into public.leads (source, source_ref, name, email, phone, company, message, budget, created_at)
  values ('website', new.id::text, new.name, new.email, new.phone, new.company, new.message, new.budget, new.created_at)
  on conflict (source, source_ref) do nothing;
  return new;
end;
$$;
