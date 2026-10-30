-- Eingangsrechnungen: Netto/USt, Zahlungsart, Kategorie und „schon bezahlt“
-- (Karte, PayPal, Lastschrift sind meist schon abgebucht).
alter table public.invoices
  add column net_amount numeric(12, 2),
  add column vat_amount numeric(12, 2),
  add column payment_method text check (payment_method in ('ueberweisung', 'lastschrift', 'karte', 'paypal', 'bar')),
  add column category text,
  add column paid boolean not null default false;
