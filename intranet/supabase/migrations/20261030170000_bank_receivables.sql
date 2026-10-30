-- Bank: Zahlungseingänge gehören jetzt zu den eigenen Ausgangsrechnungen
-- (billing_documents / billing_payments) statt zu easybill.
alter table public.bank_transactions
  drop column easybill_document_id,
  drop column easybill_number,
  drop column easybill_payment_id,
  add column billing_document_id uuid,
  add column billing_number text,
  add column billing_payment_id uuid;

alter table public.bank_transactions drop constraint bank_transactions_match_type_check;
alter table public.bank_transactions
  add constraint bank_transactions_match_type_check check (match_type in ('invoice', 'receivable', 'ignored'));
