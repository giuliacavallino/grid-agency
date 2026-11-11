-- Als Spam markierte Absender: Lead wird gelöscht, weitere Anfragen derselben
-- Adresse (Kontaktformular, Mail) legen keinen Lead mehr an.
create table public.spam_senders (
  email text primary key,
  created_at timestamptz not null default now(),
  created_by text,
  sample text
);
alter table public.spam_senders enable row level security;

create or replace function public.contact_submission_to_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.spam_senders s where s.email = lower(trim(new.email))) then
    return new;
  end if;
  insert into public.leads (source, source_ref, name, email, company, message, budget, created_at)
  values ('website', new.id::text, new.name, new.email, new.company, new.message, new.budget, new.created_at)
  on conflict (source, source_ref) do nothing;
  return new;
end;
$$;
