-- Belege der Eingangsrechnungen werden einmal aus der Mail geholt und in
-- Storage abgelegt: Vorschau sofort und unabhängig davon, ob die Mail
-- verschoben wurde oder wer angemeldet ist.
alter table public.invoices
  add column beleg_path text,
  add column beleg_type text,
  add column beleg_name text;

insert into storage.buckets (id, name, public)
values ('belege', 'belege', false)
on conflict (id) do nothing;
