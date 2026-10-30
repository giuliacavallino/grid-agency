-- Ausgangsrechnungen: Belege (Rechnung, Gutschrift, Storno, Angebot,
-- Serienrechnung …) mit Positionen und Zahlungen. Zuerst gefüllt durch den
-- einmaligen Import der easybill-Historie (Edge Function easybill-history),
-- danach schreibt das Intranet selbst hinein. raw hält den easybill-Beleg
-- unverändert fest. RLS an, keine Policies: Zugriff nur serverseitig.

-- Stammdaten, die eine Rechnung braucht
alter table public.customers
  add column customer_number text,
  add column street text,
  add column zip text,
  add column country text not null default 'DE',
  add column vat_id text,
  add column billing_email text,
  add column payment_terms_days integer;

alter table public.articles
  add column number text,
  add column vat_percent numeric(5, 2) not null default 19;

create table public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null check (kind in (
    'rechnung', 'gutschrift', 'storno', 'storno_gutschrift', 'angebot', 'auftrag',
    'lieferschein', 'zahlungserinnerung', 'mahnung', 'serie', 'proforma', 'brief', 'sonstiges'
  )),
  number text,
  status text not null default 'entwurf' check (status in (
    'entwurf', 'offen', 'teilbezahlt', 'bezahlt', 'storniert', 'angenommen', 'abgelehnt', 'erledigt'
  )),
  customer_id uuid references public.customers (id) on delete set null,
  -- Original zu Storno, Korrektur, Mahnung; Angebot zu Rechnung
  ref_document_id uuid references public.billing_documents (id) on delete set null,
  document_date date,
  due_date date,
  service_from date,
  service_to date,
  service_text text,
  title text,
  intro text,
  closing text,
  currency text not null default 'EUR',
  amount_net numeric(12, 2) not null default 0,
  amount_vat numeric(12, 2) not null default 0,
  amount_gross numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  paid_at date,
  vat_option text,
  -- Empfänger zum Zeitpunkt des Belegs
  address jsonb,
  -- Serienrechnung: Rhythmus, nächster Termin, Status
  recurring jsonb,
  pdf_path text,
  sent_at timestamptz,
  notes text,
  source text not null default 'intranet' check (source in ('intranet', 'easybill')),
  easybill_id bigint unique,
  easybill_customer_id bigint,
  easybill_ref_id bigint,
  raw jsonb
);
-- Rechnungsnummern sind eindeutig (Mahnungen u. a. tragen oft die Nummer des Originals)
create unique index billing_documents_number_idx on public.billing_documents (kind, number)
  where number is not null and kind in ('rechnung', 'gutschrift', 'storno', 'storno_gutschrift');
create index billing_documents_customer_idx on public.billing_documents (customer_id, document_date desc);
create index billing_documents_kind_idx on public.billing_documents (kind, status, document_date desc);

create table public.billing_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.billing_documents (id) on delete cascade,
  position integer not null default 0,
  kind text not null default 'position' check (kind in ('position', 'text')),
  article_id uuid references public.articles (id) on delete set null,
  number text,
  description text,
  quantity numeric(12, 4) not null default 1,
  unit text,
  unit_price_net numeric(14, 4) not null default 0,
  vat_percent numeric(5, 2) not null default 19,
  discount numeric(12, 4),
  discount_type text check (discount_type in ('prozent', 'betrag')),
  total_net numeric(12, 2) not null default 0,
  total_vat numeric(12, 2) not null default 0,
  total_gross numeric(12, 2) not null default 0
);
create index billing_items_document_idx on public.billing_items (document_id, position);

create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  document_id uuid not null references public.billing_documents (id) on delete cascade,
  paid_on date not null,
  amount numeric(12, 2) not null,
  method text,
  reference text,
  notes text,
  easybill_id bigint unique
);
create index billing_payments_document_idx on public.billing_payments (document_id);

alter table public.billing_documents enable row level security;
alter table public.billing_items enable row level security;
alter table public.billing_payments enable row level security;

create trigger billing_documents_touch before update on public.billing_documents
  for each row execute function public.touch_updated_at();

-- PDFs der Belege (privat, nur über signierte URLs)
insert into storage.buckets (id, name, public) values ('billing', 'billing', false)
on conflict (id) do nothing;
