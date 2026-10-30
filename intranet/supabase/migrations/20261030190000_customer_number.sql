-- Fortlaufende Kundennummer: bestehende Kund*innen nach Anlagedatum
-- durchnummeriert (ab 1001), neue bekommen die nächste Nummer aus der
-- Sequenz – egal ob manuell, aus gewonnenem Lead oder über easybill.
create sequence public.customers_number_seq start 1001;

alter table public.customers add column customer_number integer;

update public.customers c
set customer_number = n.nr
from (
  select id, 1000 + row_number() over (order by created_at, name, id) as nr
  from public.customers
) n
where c.id = n.id;

select setval('public.customers_number_seq', coalesce((select max(customer_number) from public.customers), 1000));

alter table public.customers
  alter column customer_number set default nextval('public.customers_number_seq'),
  alter column customer_number set not null,
  add constraint customers_customer_number_key unique (customer_number);

alter sequence public.customers_number_seq owned by public.customers.customer_number;
