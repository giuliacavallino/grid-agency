-- Fortlaufende Kundennummer. customer_number (text) kommt aus easybill
-- (siehe Rechnungsausgang) und behält dort vergebene Nummern; neue
-- Kund*innen ohne Nummer bekommen die nächste freie (höchste + 1) – egal ob
-- manuell, aus gewonnenem Lead oder über den easybill-Abgleich angelegt.
alter table public.customers add column if not exists customer_number text;

create or replace function public.next_customer_number()
returns text
language sql
volatile
set search_path = public
as $$
  select (coalesce(max(customer_number::bigint), 0) + 1)::text
  from public.customers
  where customer_number ~ '^[0-9]+$'
$$;

create or replace function public.set_customer_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.customer_number is null or btrim(new.customer_number) = '' then
    -- Gleichzeitige Anlagen nacheinander nummerieren
    perform pg_advisory_xact_lock(hashtext('customers.customer_number'));
    new.customer_number := public.next_customer_number();
  end if;
  return new;
end;
$$;

create trigger customers_set_number
  before insert on public.customers
  for each row execute function public.set_customer_number();

-- Falls Bestandskund*innen noch keine Nummer haben: nach Anlagedatum auffüllen
do $$
declare c record;
begin
  for c in select id from public.customers where customer_number is null or btrim(customer_number) = '' order by created_at, name loop
    update public.customers set customer_number = public.next_customer_number() where id = c.id;
  end loop;
end $$;
