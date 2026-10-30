-- Kundennummern eindeutig. Wer beim Anlegen eine schon vergebene Nummer
-- mitbringt (z. B. der easybill-Abgleich), bekommt stattdessen die nächste
-- freie, damit der Abgleich nicht abbricht. Beim Bearbeiten lehnt die
-- Datenbank Doppelte ab; das Intranet prüft vorher und meldet es.
create or replace function public.set_customer_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.customer_number := nullif(btrim(new.customer_number), '');
  if new.customer_number is null
    or exists (select 1 from public.customers where customer_number = new.customer_number) then
    -- Gleichzeitige Anlagen nacheinander nummerieren
    perform pg_advisory_xact_lock(hashtext('customers.customer_number'));
    new.customer_number := public.next_customer_number();
  end if;
  return new;
end;
$$;

create unique index customers_customer_number_key on public.customers (customer_number);
