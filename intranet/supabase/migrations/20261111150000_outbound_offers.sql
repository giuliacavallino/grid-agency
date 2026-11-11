-- Gesendete Mails aus den Sales-Postfächern, damit jede nur einmal geprüft
-- wird: verschickte Angebote landen als Lead in „Angebot verschickt“,
-- Nachfass-Mails verschieben den nächsten Schritt.
create table public.outbound_messages (
  id text primary key,
  mailbox text not null,
  graph_id text,
  sent_at timestamptz,
  to_email text,
  subject text,
  classification text not null check (classification in ('angebot', 'nachfassen', 'sonstiges')),
  reason text,
  lead_id uuid references public.leads (id) on delete set null,
  created_at timestamptz not null default now()
);
create index outbound_messages_sent_idx on public.outbound_messages (mailbox, sent_at desc);
alter table public.outbound_messages enable row level security;
