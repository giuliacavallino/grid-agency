-- Rechnungsadresse eines festgeschriebenen Belegs berichtigen (§ 31 Abs. 5
-- UStDV: Angaben dürfen berichtigt werden, Nummer, Datum und Beträge bleiben).
-- Nur über diese Funktionen; jede Änderung wird in raw.address_changes
-- protokolliert, das neu erzeugte PDF ersetzt das alte.

create or replace function public.billing_lock() returns trigger
language plpgsql set search_path = '' as $$
declare
  fix boolean := coalesce(current_setting('billing.address_fix', true), '') = 'on';
begin
  if old.finalized_at is null or old.source <> 'intranet' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Festgeschriebene Belege können nicht gelöscht werden';
  end if;
  if (new.kind, new.number, new.customer_id, new.ref_document_id, new.document_date, new.due_date,
      new.service_from, new.service_to, new.service_text, new.title, new.intro, new.closing, new.currency,
      new.amount_net, new.amount_vat, new.amount_gross, new.vat_option, new.finalized_at,
      new.payment_terms_days, new.source)
     is distinct from
     (old.kind, old.number, old.customer_id, old.ref_document_id, old.document_date, old.due_date,
      old.service_from, old.service_to, old.service_text, old.title, old.intro, old.closing, old.currency,
      old.amount_net, old.amount_vat, old.amount_gross, old.vat_option, old.finalized_at,
      old.payment_terms_days, old.source)
     or (not fix and new.address is distinct from old.address)
     or (not fix and old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path) then
    raise exception 'Beleg % ist festgeschrieben und kann nicht geändert werden', old.number;
  end if;
  return new;
end;
$$;

create or replace function public.billing_change_address(p_id uuid, p_address jsonb, p_by text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('billing.address_fix', 'on', true);
  update public.billing_documents
     set address = p_address,
         raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object(
           'address_changes',
           coalesce(raw -> 'address_changes', '[]'::jsonb)
             || jsonb_build_array(jsonb_build_object('at', now(), 'by', p_by, 'old', address, 'new', p_address)))
   where id = p_id;
  if not found then raise exception 'Beleg nicht gefunden'; end if;
end;
$$;

create or replace function public.billing_replace_pdf(p_id uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('billing.address_fix', 'on', true);
  update public.billing_documents set pdf_path = p_path where id = p_id;
end;
$$;

revoke execute on function public.billing_change_address(uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.billing_replace_pdf(uuid, text) from public, anon, authenticated;
