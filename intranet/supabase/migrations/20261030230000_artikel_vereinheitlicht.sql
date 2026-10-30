-- Artikel vereinheitlicht: Setup, Strategie, Betreuung (+ weitere Leistungen)
-- ohne Laufzeit im Namen. Die Laufzeit steht im Angebot (Mindestlaufzeit),
-- die Strategie kostet 300 € je Monat Laufzeit, einmalig berechnet.
-- Doppelte 6-/12-Monats-Artikel werden deaktiviert (bleiben für alte Belege).

alter table public.articles drop constraint articles_unit_check;
alter table public.articles add constraint articles_unit_check
  check (unit in ('monatlich', 'einmalig', 'stunde', 'tag', 'laufzeit'));

-- Zählbare Monatsleistungen, z. B. „Account“: Menge = Anzahl
alter table public.articles add column if not exists count_label text;

update public.articles set name = 'Setup', category = 'Setup', unit = 'einmalig', price = 1500
  where id = 'a05b4735-36ee-4880-b4ed-40fab1cf5149';

update public.articles set name = 'Strategie', category = 'Strategie', unit = 'laufzeit', price = 300,
  description = regexp_replace(description, '\s*\(300\s*€\s*/\s*Monat\)\s*$', '')
  where id = 'ef24c49b-0974-4d16-a96a-10f0d1828aca';

update public.articles set name = 'Betreuung Starter', category = 'Betreuung', unit = 'monatlich', price = 2600
  where id = '18a7b0f5-ef74-4d45-906e-fd66754b1726';
update public.articles set name = 'Betreuung Business', category = 'Betreuung', unit = 'monatlich', price = 3300
  where id = 'e5b11c22-8ca1-467c-81f5-4d6b1271bb47';
update public.articles set name = 'Betreuung Enterprise', category = 'Betreuung', unit = 'monatlich', price = 3950
  where id = 'ac4bc35f-142e-42d8-aa15-e099d0b703eb';

update public.articles set name = 'Performance Marketing', category = 'Weitere', unit = 'monatlich', price = 1750
  where id = '902173b7-532b-4e24-a68b-260d844bee03';

update public.articles set name = 'Videoproduktion: 10 Reels', category = 'Weitere', unit = 'einmalig', price = 7500,
  description = '• Erstellung von 10 Reels in den Seitenverhältnissen 9:16, 16:9 oder 1,91:1' || chr(10) || description
  where id = '91c5776a-bec3-40a8-9937-682c95cd153c' and name not like 'Videoproduktion%';

update public.articles set active = false
  where id in (
    '81cbeee7-aaa0-4e77-94eb-cbe333557472', -- Starter (6 Monate)
    'cea66b9b-88d2-4e07-a0d5-9a1212498fb6', -- Business (6 Monate)
    '65df6291-da38-40ad-a398-8a41e4cc2fc8', -- Enterprise (12 Monate)
    '245ede52-5353-4bb5-8b9b-56bea98b220e'  -- Performance Marketing (6 Monate)
  );

insert into public.articles (number, name, category, unit, price, count_label, description, active)
select '27', 'Google Account Management', 'Weitere', 'monatlich', 250, 'Account',
  '- Pflege des Google-Unternehmensprofils (Öffnungszeiten, Leistungen, Fotos, Beiträge)' || chr(10) ||
  '- Bewertungsmanagement: Beantwortung aller Google-Bewertungen' || chr(10) ||
  '- Monitoring neuer Bewertungen und Fragen' || chr(10) ||
  '- Monatliches Reporting',
  true
where not exists (select 1 from public.articles where name = 'Google Account Management');
