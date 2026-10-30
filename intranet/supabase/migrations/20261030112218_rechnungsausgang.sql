-- Rechnungsausgang im Intranet: Entwürfe, Festschreiben mit lückenlosem
-- Nummernkreis, Sperre nach dem Festschreiben (GoBD), Zahlungen und
-- Serienrechnungen. Rechnung, Storno und Gutschrift teilen sich einen
-- Nummernkreis JJ-NNN mit durchlaufendem Zähler (wie bisher in easybill).

alter table public.billing_documents
  add column finalized_at timestamptz,
  add column payment_terms_days integer,
  add column recipient_email text,
  add column sent_to text,
  add column send_error text,
  add column send_attempts integer not null default 0,
  -- Rechnung aus einer Serie: <Serien-ID>:<Termin>, verhindert Doppelte
  add column series_key text unique;

drop index if exists public.billing_documents_number_idx;
-- Neue Nummern sind über alle Belegarten eindeutig; die easybill-Stornos
-- tragen die Nummer ihrer Rechnung und bleiben außen vor.
create unique index billing_documents_number_idx on public.billing_documents (number)
  where number is not null and source = 'intranet';

create table public.billing_sequences (
  key text primary key,
  last_value integer not null
);
alter table public.billing_sequences enable row level security;

-- Weiter ab der höchsten easybill-Nummer (Rechnungen, Stornos, Gutschriften)
insert into public.billing_sequences (key, last_value)
select 'rechnung', coalesce(max(split_part(number, '-', 2)::integer), 0)
from public.billing_documents
where kind in ('rechnung', 'storno', 'gutschrift', 'storno_gutschrift') and number ~ '^\d{2}-\d+$';

-- Festschreiben: Nummer vergeben, Datum und Fälligkeit setzen, Status
-- setzen; bei einem Storno das Original auf „storniert“.
create function public.billing_finalize(p_id uuid) returns public.billing_documents
language plpgsql set search_path = '' as $$
declare
  d public.billing_documents;
  n integer;
  doc_date date;
begin
  select * into d from public.billing_documents where id = p_id for update;
  if not found then raise exception 'Beleg nicht gefunden'; end if;
  if d.finalized_at is not null or d.status <> 'entwurf' or d.source <> 'intranet' then
    raise exception 'Beleg ist bereits festgeschrieben';
  end if;
  if d.kind not in ('rechnung', 'gutschrift', 'storno', 'storno_gutschrift') then
    raise exception 'Nur Rechnungen, Gutschriften und Stornos werden festgeschrieben';
  end if;
  if d.customer_id is null then raise exception 'Kein Kunde gewählt'; end if;
  if not exists (select 1 from public.billing_items where document_id = p_id and kind = 'position') then
    raise exception 'Keine Positionen';
  end if;

  update public.billing_sequences set last_value = last_value + 1 where key = 'rechnung' returning last_value into n;
  doc_date := coalesce(d.document_date, (now() at time zone 'Europe/Berlin')::date);

  update public.billing_documents set
    number = to_char(doc_date, 'YY') || '-' || lpad(n::text, 3, '0'),
    document_date = doc_date,
    due_date = coalesce(d.due_date, doc_date + coalesce(d.payment_terms_days, 5)),
    status = case when d.kind in ('storno', 'storno_gutschrift') then 'erledigt' else 'offen' end,
    finalized_at = now()
  where id = p_id
  returning * into d;

  if d.kind in ('storno', 'storno_gutschrift') and d.ref_document_id is not null then
    update public.billing_documents set status = 'storniert' where id = d.ref_document_id;
  end if;
  return d;
end;
$$;
revoke execute on function public.billing_finalize(uuid) from public, anon, authenticated;

-- Festgeschriebene Belege sind unveränderlich. Erlaubt bleiben Status,
-- Zahlungsstand, Versand, Notizen und das einmalige Ablegen des PDFs.
-- easybill-Belege pflegt nur der Import.
create function public.billing_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.finalized_at is null or old.source <> 'intranet' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Festgeschriebene Belege können nicht gelöscht werden';
  end if;
  if (new.kind, new.number, new.customer_id, new.ref_document_id, new.document_date, new.due_date,
      new.service_from, new.service_to, new.service_text, new.title, new.intro, new.closing, new.currency,
      new.amount_net, new.amount_vat, new.amount_gross, new.vat_option, new.address, new.finalized_at,
      new.payment_terms_days, new.source)
     is distinct from
     (old.kind, old.number, old.customer_id, old.ref_document_id, old.document_date, old.due_date,
      old.service_from, old.service_to, old.service_text, old.title, old.intro, old.closing, old.currency,
      old.amount_net, old.amount_vat, old.amount_gross, old.vat_option, old.address, old.finalized_at,
      old.payment_terms_days, old.source)
     or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path) then
    raise exception 'Beleg % ist festgeschrieben und kann nicht geändert werden', old.number;
  end if;
  return new;
end;
$$;
create trigger billing_documents_lock before update or delete on public.billing_documents
  for each row execute function public.billing_lock();

create function public.billing_items_lock() returns trigger
language plpgsql set search_path = '' as $$
declare
  doc uuid := case when tg_op = 'DELETE' then old.document_id else new.document_id end;
begin
  if exists (select 1 from public.billing_documents where id = doc and finalized_at is not null and source = 'intranet') then
    raise exception 'Positionen eines festgeschriebenen Belegs können nicht geändert werden';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger billing_items_lock before insert or update or delete on public.billing_items
  for each row execute function public.billing_items_lock();

-- Zahlungsstand aus den Zahlungen (auch für offene easybill-Rechnungen)
create function public.billing_payment_sync() returns trigger
language plpgsql set search_path = '' as $$
declare
  doc uuid := case when tg_op = 'DELETE' then old.document_id else new.document_id end;
  paid numeric;
  last_paid date;
begin
  select coalesce(sum(amount), 0), max(paid_on) into paid, last_paid from public.billing_payments where document_id = doc;
  update public.billing_documents set
    paid_amount = paid,
    paid_at = case when abs(paid) >= abs(amount_gross) then last_paid end,
    status = case
      when paid = 0 then 'offen'
      when abs(paid) >= abs(amount_gross) then 'bezahlt'
      else 'teilbezahlt'
    end
  where id = doc and status in ('offen', 'teilbezahlt', 'bezahlt');
  return null;
end;
$$;
create trigger billing_payments_sync after insert or update or delete on public.billing_payments
  for each row execute function public.billing_payment_sync();
