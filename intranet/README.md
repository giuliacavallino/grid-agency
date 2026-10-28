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
- `/sales` – Pipeline (Kanban), Posteingang und Kalender von hello@, Kunden, Auftragsbuch, Artikel, Analytics
- `src/app/api/sales/*` – Daten-API. Prüft das Microsoft-ID-Token (Signatur, Tenant, Client-ID) und spricht mit Supabase über den Service-Key.
- `src/app/api/webhooks/*` – Lead-Eingang aus Meta, LinkedIn und hello@
- `supabase/migrations` – Schema der Sales-Tabellen (RLS an, ohne Policies: nur der Server hat Zugriff)

Hell- und Dunkelmodus folgen der Systemeinstellung. Farben kommen aus Tokens in `src/app/globals.css`: `snow` ist immer die Vordergrundfarbe, `sky` der Hintergrund.

## Woher Leads kommen

| Quelle | Weg |
| --- | --- |
| Kontaktformular der Website | Datenbank-Trigger `contact_submissions` → `leads` |
| Meta / Instagram Lead Ads | Webhook `POST /api/webhooks/meta` (Feld `leadgen`) |
| LinkedIn Lead Gen | Webhook `POST /api/webhooks/linkedin` (Lead Sync) |
| Mails an hello@ | Graph-Benachrichtigung `POST /api/webhooks/mail` und täglicher Abgleich `GET /api/cron/mail`. Claude ordnet jede Mail als Anfrage, Bewerbung oder Sonstiges ein, und nur Anfragen werden zur Kachel. |
| Manuell | „Neuer Lead“ in der Pipeline oder „Als Lead anlegen“ im Posteingang |

## Einrichtung (einmalig)

**Vercel-Umgebungsvariablen** im Projekt `grid-intranet` (siehe `.env.example`):

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: ohne sie bleiben die Sales-Seiten leer.
- `MS_CLIENT_SECRET`, `MAIL_WEBHOOK_SECRET` (beliebiger langer Zufallswert), `CRON_SECRET`, `INTRANET_URL`
- `ANTHROPIC_API_KEY`: ohne Key ordnen einfache Stichwort-Regeln die Mails ein.
- `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`
- `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`

**Microsoft Entra** (App „GRID Intranet“):

1. API-Berechtigungen, delegiert: `Mail.ReadWrite.Shared`, `Mail.Send.Shared`, `Calendars.ReadWrite.Shared` (Posteingang und Kalender im Sales). Nach Möglichkeit Administratorzustimmung erteilen.
2. Anwendungsberechtigung `Mail.Read` mit Administratorzustimmung (Mail-Eingang). Am besten per Application Access Policy auf hello@ beschränken.
3. Unter „Zertifikate & Geheimnisse“ ein Client-Secret anlegen und als `MS_CLIENT_SECRET` hinterlegen.
4. Exchange: Wer im Sales arbeitet, braucht Vollzugriff und „Senden als“ auf hello@.
5. SPA-Redirect-URIs: jede Intranet-URL mit `/` am Ende (Produktion, Previews, `http://localhost:3000/`).

**Meta:** In der Meta-App das Webhook-Produkt „Page“ mit Feld `leadgen` auf `https://intranet.grid-agency.de/api/webhooks/meta` einrichten (Verify Token = `META_VERIFY_TOKEN`). Die App braucht die Rechte `leads_retrieval` und `pages_manage_metadata` und einen Page Access Token.

**LinkedIn:** App mit Lead-Sync-API-Zugang, Webhook auf `https://intranet.grid-agency.de/api/webhooks/linkedin` registrieren und für die Lead-Formulare des Ad-Accounts abonnieren. Der Access Token braucht `r_marketing_leadgen_automation`.

**hello@-Abo:** Der Cron (täglich, `vercel.json`) legt das Graph-Abo an und verlängert es. Zum Start einmal manuell aufrufen:
`curl -H "Authorization: Bearer $CRON_SECRET" https://intranet.grid-agency.de/api/cron/mail`
