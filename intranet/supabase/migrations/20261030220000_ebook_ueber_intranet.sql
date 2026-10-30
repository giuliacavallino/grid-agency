-- E-Book-Anforderungen laufen jetzt über das Intranet (/api/public/ebook:
-- Captcha, Lead, Versand des PDFs von hello@). Der direkte Weg für anon
-- entfällt. Erst anwenden, wenn die Website mit dem neuen Formular live ist.
drop function if exists public.submit_ebook_lead(text, text, text, boolean, jsonb);
