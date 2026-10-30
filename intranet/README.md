# GRID Intranet

Next.js-App unter `intranet/` (Vercel-Projekt `grid-intranet`, Root Directory `intranet`), Login über Microsoft 365 (Entra-App „GRID Intranet“).

```bash
cd intranet
npm install
npm run dev
```

Für die lokale Vorschau ohne Login und Datenbank `NEXT_PUBLIC_INTRANET_DEMO=1` in `.env.development.local` setzen. Dann laufen alle Seiten mit Beispieldaten. Im Produktions-Build ist der Modus immer aus.

## Aufbau

- `/` – Login und Hub mit den Bereichskacheln
- `/sales` – Pipeline (Kanban), Posteingang und Kalender von hello@ und giulia@, Kunden, Auftragsbuch, Artikel, Analytics
- `/finance` – Eingangsrechnungen als Kanban (Neu → Freigegeben → An DATEV gesendet), Ausgangsrechnungen (Rechnungen, Gutschriften, Stornos, Serien schreiben und verschicken; dazu alle Belege aus easybill), Posteingang von buchhaltung@, Einstellungen (DATEV-Upload-Adresse, Firmendaten und Texte der Rechnungen)
- `/personal` – Bewerbungen als Kanban (Neue Bewerbung → Gespräch → Case Study → Zusage / Absage)
- `/mail` – Posteingang und Kalender aller Postfächer (hello@, giulia@, buchhaltung@, google@)
- `/aufgaben` – To-dos je Kunde (ersetzt Asana): Kacheln aller Kunden, je Kunde eine Liste wie in Asana (Themen als Gruppen, alles direkt in der Zeile bearbeitbar, speichert automatisch), „Meine To-dos“ über alle Kunden, Briefing je Kunde (Zugänge, Ansprechpartner, Postingplan), ehemalige Kunden im Archiv

Welche Postfächer wo erscheinen, steht in `MAILBOXES` in `src/lib/config.ts`.
- `src/app/api/sales/*` – Daten-API. Prüft das Microsoft-ID-Token (Signatur, Tenant, Client-ID) und spricht mit Supabase über den Service-Key.
- `src/app/api/webhooks/*` – Lead-Eingang aus Meta, LinkedIn und hello@
- `supabase/migrations` – Schema der Sales-Tabellen (RLS an, ohne Policies: nur der Server hat Zugriff)
- `supabase/functions/easybill-history` – einmaliger Import der easybill-Historie (siehe unten)

Hell- und Dunkelmodus folgen der Systemeinstellung. Farben kommen aus Tokens in `src/app/globals.css`: `snow` ist immer die Vordergrundfarbe, `sky` der Hintergrund.

## Woher Leads kommen

| Quelle | Weg |
| --- | --- |
| Kontaktformular der Website | Datenbank-Trigger `contact_submissions` → `leads` |
| Meta / Instagram Lead Ads | Webhook `POST /api/webhooks/meta` (Feld `leadgen`) |
| LinkedIn Lead Gen | Webhook `POST /api/webhooks/linkedin` (Lead Sync) |
| Mails an alle Postfächer aus `MAILBOXES` | Graph-Benachrichtigung `POST /api/webhooks/mail` (ein Abo je Postfach) und täglicher Abgleich `GET /api/cron/mail`. Claude ordnet jede Mail ein: Anfrage → Lead in Sales, Bewerbung → Personal, Rechnung → Finance, Sonstiges bleibt nur im Postfach. |
| Manuell | „Neuer Lead“ in der Pipeline oder „Als Lead anlegen“ im Posteingang |

## Einrichtung (einmalig)

**Vercel-Umgebungsvariablen** im Projekt `grid-intranet` (siehe `.env.example`):

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: ohne sie bleiben die Sales-Seiten leer.
- `MS_CLIENT_SECRET`, `MAIL_WEBHOOK_SECRET` (beliebiger langer Zufallswert), `CRON_SECRET`, `INTRANET_URL`
- `ANTHROPIC_API_KEY`: ohne Key ordnen einfache Stichwort-Regeln die Mails ein.
- `EASYBILL_API_KEY`: easybill → Einstellungen → API. Damit gleicht das Intranet Kunden, Artikel, Serienrechnungen (→ Retainer) und offene Angebote (→ Leads in „Angebot“) ab, täglich und per Knopf „easybill“ in Kunden, Auftragsbuch und Artikel.
- `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`
- `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`

**Microsoft Entra** (App „GRID Intranet“):

1. API-Berechtigungen, delegiert: `Mail.ReadWrite.Shared`, `Mail.Send.Shared`, `Calendars.ReadWrite.Shared` (Posteingang und Kalender im Sales). Nach Möglichkeit Administratorzustimmung erteilen.
2. Anwendungsberechtigung `Mail.Read` mit Administratorzustimmung (Mail-Eingang). Am besten per Application Access Policy auf hello@ beschränken.
3. Unter „Zertifikate & Geheimnisse“ ein Client-Secret anlegen und als `MS_CLIENT_SECRET` hinterlegen.
4. Exchange: Vollzugriff und „Senden als“ auf jedes geteilte Postfach aus `MAILBOXES` (hello@, buchhaltung@, google@). Der DATEV-Versand läuft über „Senden als“ von buchhaltung@.
5. SPA-Redirect-URIs: jede Intranet-URL mit `/` am Ende (Produktion, Previews, `http://localhost:3000/`).

**Meta:** In der Meta-App das Webhook-Produkt „Page“ mit Feld `leadgen` auf `https://intranet.grid-agency.de/api/webhooks/meta` einrichten (Verify Token = `META_VERIFY_TOKEN`). Die App braucht die Rechte `leads_retrieval` und `pages_manage_metadata` und einen Page Access Token.

**LinkedIn:** App mit Lead-Sync-API-Zugang, Webhook auf `https://intranet.grid-agency.de/api/webhooks/linkedin` registrieren und für die Lead-Formulare des Ad-Accounts abonnieren. Der Access Token braucht `r_marketing_leadgen_automation`.

**DATEV:** Upload-Adresse (`…@uploadmail.datev.de`) in Finance → Einstellungen eintragen. „An DATEV senden“ holt die Anhänge der Rechnungsmail und schickt sie von buchhaltung@ an diese Adresse.

**Mail-Abos:** Der Cron (täglich, `vercel.json`) legt je Postfach ein Graph-Abo an und verlängert es. Zum Start einmal manuell aufrufen:
`curl -H "Authorization: Bearer $CRON_SECRET" https://intranet.grid-agency.de/api/cron/mail`

## easybill-Historie (Ausgangsrechnungen)

Alle easybill-Belege (Rechnungen, Stornos, Angebote, Serienrechnungen, Mahnungen …) mit Positionen, Zahlungen und PDFs liegen in `billing_documents`, `billing_items`, `billing_payments` und im privaten Storage-Bucket `billing`. Kunden und Artikel bekommen dabei Anschrift, Kundennummer, USt-IdNr. und Steuersatz. Geladen hat sie die Edge Function `easybill-history`. Sie liest `EASYBILL_API_KEY` aus den Supabase-Secrets und ist wiederholbar (Abgleich über die easybill-ID):

```bash
curl -X POST https://pmjfgzjoaloggzbpvnrq.supabase.co/functions/v1/easybill-history \
  -H "x-import-token: $TOKEN" -d '{"step":"data"}'
curl -X POST https://pmjfgzjoaloggzbpvnrq.supabase.co/functions/v1/easybill-history \
  -H "x-import-token: $TOKEN" -d '{"step":"pdfs","after":0}'
```

Der Token wird nur als SHA-256-Hash in `sales_settings.easybill_import` gespeichert; für einen neuen Lauf einen neuen Token erzeugen und den Hash dort ersetzen. `pdfs` arbeitet in Portionen und gibt `cursor` und `remaining` zurück. Den Plan für das eigene Rechnungstool beschreibt `docs/rechnungsausgang.md`.

## Rechnungsausgang

Finance → Ausgangsrechnungen schreibt Rechnungen, Gutschriften und Serienrechnungen:

- **Entwurf → Festschreiben → Senden → Zahlung.** Beim Festschreiben vergibt die Datenbankfunktion `billing_finalize` die nächste Nummer (`JJ-NNN`, durchlaufend ab 26-222, gemeinsam für Rechnung, Gutschrift und Storno) und das PDF landet im Bucket `billing`. Danach sperrt ein Trigger den Beleg (GoBD); geändert werden nur noch Status, Zahlungen und Versand.
- **Storno** (eigene Nummer, Gegenbuchung aller Positionen), **Korrektur** (Storno und Kopie als neuer Entwurf) und **Gutschrift** über einen Teilbetrag gehen auch für Rechnungen aus easybill.
- **Versand** von buchhaltung@ über Graph im Browser (wie der DATEV-Versand), mit PDF im Anhang.
- **Serienrechnungen**: Der Cron `GET /api/cron/billing` (täglich, `vercel.json`) erzeugt fällige Rechnungen, schreibt sie fest und verschickt sie ohne angemeldete Person. Dafür braucht die Entra-App zusätzlich die **Anwendungsberechtigung `Mail.Send`** mit Admin-Zustimmung (am besten per Application Access Policy auf buchhaltung@ beschränkt). Scheitert der Versand, steht der Fehler am Beleg und er lässt sich von Hand senden. easybill-Serien laufen in easybill weiter, bis sie im Intranet „übernommen“ werden; vorher in easybill stoppen.
- **Rechnungspapier** (`src/lib/server/invoice-pdf.tsx`, react-pdf): Look der Website, Readex Pro (statische Schnitte in `src/lib/server/fonts`, per `outputFileTracingIncludes` in die Funktionen gepackt), GiroCode für Banking-Apps. Firmendaten und Texte stehen in Finance → Einstellungen.
