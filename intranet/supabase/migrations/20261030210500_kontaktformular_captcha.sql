-- Kontaktformular geht nur noch über das Intranet (mit Captcha-Prüfung,
-- Service-Key). Direkte Einträge mit dem öffentlichen Schlüssel sind zu.
-- Erst anwenden, wenn die Website mit dem neuen Formular live ist.
drop policy if exists "Allow public insert" on public.contact_submissions;
