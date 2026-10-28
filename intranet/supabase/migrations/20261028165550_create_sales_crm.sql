-- Sales-CRM des Intranets. Zugriff nur serverseitig über den Service-Key
-- (RLS an, keine Policies): Das Intranet prüft das Microsoft-Token und
-- spricht dann mit der Datenbank.
-- Angewendet auf Projekt "GRID AGENCY UG" (pmjfgzjoaloggzbpvnrq).

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  industry text,
  city text,
  status text not null default 'aktiv' check (status in ('aktiv', 'pausiert', 'ehemalig')),
  source text,
  notes text
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stage text not null default 'neu'
    check (stage in ('neu', 'eingeladen', 'erstgespraech', 'angebot', 'gewonnen')),
  position double precision not null default extract(epoch from now()),
  status text not null default 'offen' check (status in ('offen', 'verloren')),
  source text not null default 'manuell'
    check (source in ('website', 'meta', 'instagram', 'linkedin', 'email', 'empfehlung', 'manuell')),
  source_ref text,
  name text not null,
  company text,
  email text,
  phone text,
  message text,
  budget text,
  value numeric(12, 2),
  owner text,
  next_step text,
  next_step_at timestamptz,
  customer_id uuid references public.customers (id) on delete set null,
  won_at timestamptz,
  lost_reason text,
  raw jsonb,
  unique (source, source_ref)
);
create index leads_stage_idx on public.leads (status, stage, position);

alter table public.customers
  add column lead_id uuid references public.leads (id) on delete set null;

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null default 'notiz' check (kind in ('notiz', 'stage', 'email', 'anruf', 'termin', 'system')),
  author text,
  body text,
  from_stage text,
  to_stage text
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  category text,
  description text,
  price numeric(12, 2) not null default 0,
  unit text not null default 'monatlich' check (unit in ('monatlich', 'einmalig', 'stunde', 'tag')),
  hours numeric(8, 2) not null default 0,
  active boolean not null default true
);

create table public.retainers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  article_id uuid references public.articles (id) on delete set null,
  title text not null,
  monthly_fee numeric(12, 2) not null default 0,
  hours_per_month numeric(8, 2) not null default 0,
  start_date date not null default current_date,
  end_date date,
  status text not null default 'aktiv' check (status in ('aktiv', 'pausiert', 'gekuendigt')),
  notes text
);
create index retainers_customer_idx on public.retainers (customer_id);

-- Eingegangene Mails an hello@, damit jede nur einmal klassifiziert wird
-- (Anfrage → Lead, Bewerbung/Sonstiges → nur protokolliert).
create table public.inbound_messages (
  id text primary key,
  received_at timestamptz,
  from_email text,
  from_name text,
  subject text,
  classification text not null check (classification in ('anfrage', 'bewerbung', 'sonstiges')),
  reason text,
  lead_id uuid references public.leads (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.sales_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.sales_settings (key, value)
values ('capacity', '{"team_hours_per_month": 480}');

alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.articles enable row level security;
alter table public.retainers enable row level security;
alter table public.inbound_messages enable row level security;
alter table public.sales_settings enable row level security;

-- updated_at pflegen
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

-- Stage-Wechsel protokollieren (Grundlage für Analytics: Dauer je Phase)
create function public.log_lead_stage() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_activities (lead_id, kind, to_stage, body)
    values (new.id, 'stage', new.stage, 'Lead angelegt');
  elsif new.stage is distinct from old.stage then
    insert into public.lead_activities (lead_id, kind, from_stage, to_stage)
    values (new.id, 'stage', old.stage, new.stage);
    if new.stage = 'gewonnen' and new.won_at is null then
      new.won_at := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger leads_stage_before before update on public.leads
  for each row execute function public.log_lead_stage();
create trigger leads_stage_after_insert after insert on public.leads
  for each row execute function public.log_lead_stage();

-- Kontaktformular der Website → Lead. Die Website schreibt als anon,
-- daher security definer.
create function public.contact_submission_to_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.leads (source, source_ref, name, email, company, message, budget, created_at)
  values ('website', new.id::text, new.name, new.email, new.company, new.message, new.budget, new.created_at)
  on conflict (source, source_ref) do nothing;
  return new;
end;
$$;
revoke execute on function public.contact_submission_to_lead() from public, anon, authenticated;
create trigger contact_submissions_to_lead after insert on public.contact_submissions
  for each row execute function public.contact_submission_to_lead();

-- Bisherige Anfragen übernehmen
insert into public.leads (source, source_ref, name, email, company, message, budget, created_at)
select 'website', id::text, name, email, company, message, budget, created_at
from public.contact_submissions
on conflict (source, source_ref) do nothing;
