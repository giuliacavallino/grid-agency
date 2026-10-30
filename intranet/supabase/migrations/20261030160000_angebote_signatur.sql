-- Angebote mit Vertrag und SEPA-Mandat zur elektronischen Unterschrift auf
-- sign.grid-agency.de. Eine Mappe (sign_envelopes) bündelt Angebot, Vertrag
-- und Mandat; nach der Unterschrift landet das versiegelte PDF in der
-- Kundenakte (customer_documents). RLS an, keine Policies: nur der Server.

-- Angebote: eigener Nummernkreis JJ-NNN, weiter ab der höchsten easybill-Nummer
insert into public.billing_sequences (key, last_value)
select 'angebot', coalesce(max(split_part(number, '-', 2)::integer), 0)
from public.billing_documents
where kind = 'angebot' and number ~ '^\d{2}-\d+$';

drop index if exists public.billing_documents_number_idx;
create unique index billing_documents_number_idx on public.billing_documents (number)
  where number is not null and source = 'intranet' and kind <> 'angebot';
create unique index billing_documents_offer_number_idx on public.billing_documents (number)
  where number is not null and source = 'intranet' and kind = 'angebot';

create or replace function public.billing_finalize(p_id uuid) returns public.billing_documents
language plpgsql set search_path = '' as $$
declare
  d public.billing_documents;
  n integer;
  doc_date date;
  seq text;
begin
  select * into d from public.billing_documents where id = p_id for update;
  if not found then raise exception 'Beleg nicht gefunden'; end if;
  if d.finalized_at is not null or d.status <> 'entwurf' or d.source <> 'intranet' then
    raise exception 'Beleg ist bereits festgeschrieben';
  end if;
  if d.kind not in ('rechnung', 'gutschrift', 'storno', 'storno_gutschrift', 'angebot') then
    raise exception 'Diese Belegart wird nicht festgeschrieben';
  end if;
  if d.customer_id is null then raise exception 'Kein Kunde gewählt'; end if;
  if not exists (select 1 from public.billing_items where document_id = p_id and kind = 'position') then
    raise exception 'Keine Positionen';
  end if;

  seq := case when d.kind = 'angebot' then 'angebot' else 'rechnung' end;
  update public.billing_sequences set last_value = last_value + 1 where key = seq returning last_value into n;
  doc_date := coalesce(d.document_date, (now() at time zone 'Europe/Berlin')::date);

  update public.billing_documents set
    number = to_char(doc_date, 'YY') || '-' || lpad(n::text, 3, '0'),
    document_date = doc_date,
    -- Angebot: gültig bis; sonst fällig am
    due_date = coalesce(d.due_date, doc_date + coalesce(d.payment_terms_days, case when d.kind = 'angebot' then 14 else 5 end)),
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

-- SEPA-Mandat am Kunden (aus der unterschriebenen Mappe)
alter table public.customers
  add column sepa_mandate_reference text,
  add column sepa_holder text,
  add column sepa_iban text,
  add column sepa_bic text,
  add column sepa_signed_at timestamptz;

create table public.sign_envelopes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  document_id uuid not null references public.billing_documents (id) on delete restrict,
  customer_id uuid references public.customers (id) on delete set null,
  -- SHA-256 des Links; der Link selbst wird nur einmal angezeigt bzw. gemailt
  token_hash text not null unique,
  status text not null default 'versendet'
    check (status in ('versendet', 'geoeffnet', 'unterschrieben', 'abgelehnt', 'widerrufen')),
  signer_name text not null,
  signer_email text not null,
  -- Vertrag zum Zeitpunkt des Versands (Titel, Abschnitte, Laufzeit …)
  contract jsonb not null,
  sepa_required boolean not null default true,
  mandate_reference text,
  grid_signer text not null,
  grid_signature text not null,
  grid_signed_at timestamptz not null default now(),
  customer_signature text,
  customer_signed_at timestamptz,
  sepa jsonb,
  decline_reason text,
  audit jsonb not null default '[]',
  unsigned_hash text,
  signed_hash text,
  pdf_path text,
  sent_by text,
  sent_at timestamptz,
  viewed_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  mail_error text
);
create index sign_envelopes_document_idx on public.sign_envelopes (document_id);
create index sign_envelopes_customer_idx on public.sign_envelopes (customer_id);

create table public.customer_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  kind text not null default 'vertrag' check (kind in ('vertrag', 'angebot', 'sepa', 'sonstiges')),
  title text not null,
  pdf_path text not null,
  envelope_id uuid references public.sign_envelopes (id) on delete set null,
  document_id uuid references public.billing_documents (id) on delete set null
);
create index customer_documents_customer_idx on public.customer_documents (customer_id, created_at desc);

alter table public.sign_envelopes enable row level security;
alter table public.customer_documents enable row level security;

create trigger sign_envelopes_touch before update on public.sign_envelopes
  for each row execute function public.touch_updated_at();

-- Unterschriebene Mappen sind unveränderlich (außer Versandfehler der Abschlussmail)
create function public.sign_envelope_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'unterschrieben' and old.pdf_path is not null then
    if tg_op = 'DELETE' then raise exception 'Unterschriebene Mappen können nicht gelöscht werden'; end if;
    if (new.status, new.pdf_path, new.signed_hash, new.customer_signature, new.sepa, new.contract)
       is distinct from (old.status, old.pdf_path, old.signed_hash, old.customer_signature, old.sepa, old.contract) then
      raise exception 'Unterschriebene Mappe kann nicht geändert werden';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger sign_envelopes_lock before update or delete on public.sign_envelopes
  for each row execute function public.sign_envelope_lock();

-- Siegel-Zertifikat im Vault (vom Server beim ersten Gebrauch erzeugt)
create function public.seal_secret_get() returns jsonb
language sql security definer set search_path = '' as $$
  select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'grid_seal' limit 1;
$$;
create function public.seal_secret_set(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('grid_seal'));
  if not exists (select 1 from vault.secrets where name = 'grid_seal') then
    perform vault.create_secret(p::text, 'grid_seal', 'Dokumentensiegel für sign.grid-agency.de');
  end if;
  return (select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'grid_seal' limit 1);
end;
$$;
revoke execute on function public.seal_secret_get() from public, anon, authenticated;
revoke execute on function public.seal_secret_set(jsonb) from public, anon, authenticated;
grant execute on function public.seal_secret_get() to service_role;
grant execute on function public.seal_secret_set(jsonb) to service_role;
