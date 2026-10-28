-- Mail-Eingang aus mehreren Postfächern (hello@, giulia@, buchhaltung@,
-- google@): Rechnungen → Finance, Bewerbungen → Personal, Anfragen → Sales.
-- RLS an, keine Policies: Zugriff nur serverseitig über den Service-Key.

alter table public.inbound_messages
  add column mailbox text,
  add column graph_id text,
  add column invoice_id uuid,
  add column application_id uuid;

alter table public.inbound_messages drop constraint inbound_messages_classification_check;
alter table public.inbound_messages
  add constraint inbound_messages_classification_check
  check (classification in ('anfrage', 'bewerbung', 'rechnung', 'sonstiges'));

-- Eingangsrechnungen: erfasst aus der Mail, geprüft, freigegeben und dann
-- per Upload-Mail an DATEV weitergeleitet (von buchhaltung@).
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stage text not null default 'neu' check (stage in ('neu', 'freigegeben', 'datev', 'abgelehnt')),
  position double precision not null default extract(epoch from now()),
  source_ref text unique,
  mailbox text,
  graph_id text,
  received_at timestamptz,
  vendor text not null,
  vendor_email text,
  invoice_number text,
  invoice_date date,
  due_date date,
  amount numeric(12, 2),
  currency text not null default 'EUR',
  description text,
  attachment_names text[],
  approved_by text,
  approved_at timestamptz,
  datev_sent_at timestamptz,
  datev_sent_by text,
  notes text,
  raw jsonb
);
create index invoices_stage_idx on public.invoices (stage, position);

-- Bewerbungen: Kanban im Bereich Personal
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stage text not null default 'neu' check (stage in ('neu', 'gespraech', 'case_study', 'zusage', 'absage')),
  position double precision not null default extract(epoch from now()),
  source_ref text unique,
  mailbox text,
  graph_id text,
  received_at timestamptz,
  name text not null,
  email text,
  phone text,
  position_title text,
  message text,
  attachment_names text[],
  owner text,
  next_step text,
  next_step_at timestamptz,
  notes text,
  raw jsonb
);
create index applications_stage_idx on public.applications (stage, position);

alter table public.inbound_messages
  add constraint inbound_messages_invoice_fk foreign key (invoice_id) references public.invoices (id) on delete set null,
  add constraint inbound_messages_application_fk foreign key (application_id) references public.applications (id) on delete set null;

alter table public.invoices enable row level security;
alter table public.applications enable row level security;

create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();
create trigger applications_touch before update on public.applications
  for each row execute function public.touch_updated_at();
