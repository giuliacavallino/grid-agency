-- Bankanbindung (Finance → Bank): Firmenkonto über Enable Banking (PSD2).
-- Ein Konto je freigegebenem Bankkonto, Umsätze nur gebucht (keine
-- vorgemerkten). Abbuchungen werden Eingangsrechnungen zugeordnet,
-- Zahlungseingänge den Ausgangsrechnungen in easybill.
-- RLS an, keine Policies: Zugriff nur serverseitig über den Service-Key.

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uid text not null unique,
  session_id text not null,
  aspsp text not null,
  iban text,
  name text,
  currency text not null default 'EUR',
  balance numeric(14, 2),
  balance_type text,
  balance_at timestamptz,
  valid_until timestamptz,
  synced_at timestamptz,
  active boolean not null default true,
  error text
);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  account_id uuid not null references public.bank_accounts (id) on delete cascade,
  ref text not null unique,
  booking_date date not null,
  value_date date,
  amount numeric(14, 2) not null,
  currency text not null default 'EUR',
  counterparty text,
  counterparty_iban text,
  purpose text,
  match_type text check (match_type in ('invoice', 'easybill', 'ignored')),
  invoice_id uuid references public.invoices (id) on delete set null,
  easybill_document_id bigint,
  easybill_number text,
  easybill_payment_id bigint,
  matched_by text,
  matched_at timestamptz,
  note text,
  raw jsonb
);
create index bank_transactions_booking_idx on public.bank_transactions (booking_date desc);
create index bank_transactions_invoice_idx on public.bank_transactions (invoice_id);

-- Eingangsrechnung ↔ Abbuchung; setzt zusätzlich invoices.paid
alter table public.invoices
  add column paid_at date,
  add column bank_transaction_id uuid references public.bank_transactions (id) on delete set null;

alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;

create trigger bank_accounts_touch before update on public.bank_accounts
  for each row execute function public.touch_updated_at();
create trigger bank_transactions_touch before update on public.bank_transactions
  for each row execute function public.touch_updated_at();
