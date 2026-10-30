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
- `/finance` – Eingangsrechnungen als Kanban (Neu → Freigegeben → An DATEV gesendet), Bank (Saldo und Umsätze des Firmenkontos, Abbuchungen ↔ Eingangsrechnungen, Zahlungseingänge ↔ easybill-Rechnungen), Posteingang von buchhaltung@, Einstellungen (DATEV-Upload-Adresse)
- `/personal` – Bewerbungen als Kanban (Neue Bewerbung → Gespräch → Case Study → Zusage / Absage)
- `/mail` – Posteingang und Kalender aller Postfächer (hello@, giulia@, buchhaltung@, google@)
- `/aufgaben` – To-dos je Kunde (ersetzt Asana): Kacheln aller Kunden, je Kunde eine Liste wie in Asana (Themen als Gruppen, alles direkt in der Zeile bearbeitbar, speichert automatisch), „Meine To-dos“ über alle Kunden, Briefing je Kunde (Zugänge, Ansprechpartner, Postingplan), ehemalige Kunden im Archiv
- `/admin` – Admin-Konsole (nur Rolle Admin): Passwort-Tresor (Kunden-Zugänge sehen alle mit Aufgaben, interne nur Admins; AES-256-GCM-verschlüsselt, Anzeigen/Kopieren/Ändern im Protokoll), Benutzer & Rechte (wer ins Intranet darf, Rolle Admin oder Mitarbeiter*in mit freigegebenen Bereichen; Tabelle `intranet_users`), Firmendaten, Protokoll

Teams: Über das Sprechblasen-Symbol (Hub oben rechts, Seitenleiste „Teams“) öffnen sich die eigenen Teams-Chats: lesen, antworten, neuer 1:1-Chat mit dem Team. Aus einem To-do heraus schickt „Per Teams schicken“ es an die zuständige Person (Nachricht vorausgefüllt, gesendet wird erst auf Knopfdruck). Alles läuft mit dem Microsoft-Login der Person (`Chat.ReadWrite`), Nachrichten kommen also von ihr selbst.

Zugang: Nur Microsoft-Konten, die in Admin → Benutzer & Rechte aktiv sind, kommen hinein. Jede API-Route prüft das (`withUser` in `src/lib/server/auth.ts`); welche Tabelle zu welchem Bereich gehört, steht in `TABLE_AREAS` in `src/lib/server/db.ts`. Aufgaben-Listen mit `restricted` (z. B. „Geschäftsführung“) sehen nur Admins.

Welche Postfächer wo erscheinen, steht in `MAILBOXES` in `src/lib/config.ts`.
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
| Mails an alle Postfächer aus `MAILBOXES` | Graph-Benachrichtigung `POST /api/webhooks/mail` (ein Abo je Postfach) und täglicher Abgleich `GET /api/cron/mail`. Claude ordnet jede Mail ein: Anfrage → Lead in Sales, Bewerbung → Personal, Rechnung → Finance, Sonstiges bleibt nur im Postfach. |
| Manuell | „Neuer Lead“ in der Pipeline oder „Als Lead anlegen“ im Posteingang |

## Einrichtung (einmalig)

**Vercel-Umgebungsvariablen** im Projekt `grid-intranet` (siehe `.env.example`):

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: ohne sie bleiben die Sales-Seiten leer.
- `MS_CLIENT_SECRET`, `MAIL_WEBHOOK_SECRET` (beliebiger langer Zufallswert), `CRON_SECRET`, `INTRANET_URL`
- `ANTHROPIC_API_KEY`: ohne Key ordnen einfache Stichwort-Regeln die Mails ein.
- `VAULT_KEY`: Schlüssel des Passwort-Tresors, 32 Byte base64 (`openssl rand -base64 32`). Nie ändern oder löschen, sonst lassen sich gespeicherte Passwörter nicht mehr entschlüsseln. Bis er gesetzt ist, liegen die aus Asana übernommenen Passwörter unverschlüsselt vor; beim ersten Öffnen von Admin danach werden sie automatisch verschlüsselt.
- `EASYBILL_API_KEY`: easybill → Einstellungen → API. Damit gleicht das Intranet Kunden, Artikel, Serienrechnungen (→ Retainer) und offene Angebote (→ Leads in „Angebot“) ab, täglich und per Knopf „easybill“ in Kunden, Auftragsbuch und Artikel.
- `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_PRIVATE_KEY`: Bankanbindung (Finance → Bank), siehe unten.
- `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`
- `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`

**Microsoft Entra** (App „GRID Intranet“):

1. API-Berechtigungen, delegiert: `Mail.ReadWrite.Shared`, `Mail.Send.Shared`, `Calendars.ReadWrite.Shared` (Posteingang und Kalender im Sales), `Chat.ReadWrite` (Teams-Chats), `User.ReadBasic.All` (Profilbilder). Nach Möglichkeit Administratorzustimmung erteilen, sonst stimmt jede Person beim ersten Mal selbst zu.
2. Anwendungsberechtigung `Mail.Read` mit Administratorzustimmung (Mail-Eingang). Am besten per Application Access Policy auf hello@ beschränken.
3. Unter „Zertifikate & Geheimnisse“ ein Client-Secret anlegen und als `MS_CLIENT_SECRET` hinterlegen.
4. Exchange: Vollzugriff und „Senden als“ auf jedes geteilte Postfach aus `MAILBOXES` (hello@, buchhaltung@, google@). Der DATEV-Versand läuft über „Senden als“ von buchhaltung@.
5. SPA-Redirect-URIs: jede Intranet-URL mit `/` am Ende (Produktion, Previews, `http://localhost:3000/`).

**Meta:** In der Meta-App das Webhook-Produkt „Page“ mit Feld `leadgen` auf `https://intranet.grid-agency.de/api/webhooks/meta` einrichten (Verify Token = `META_VERIFY_TOKEN`). Die App braucht die Rechte `leads_retrieval` und `pages_manage_metadata` und einen Page Access Token.

**LinkedIn:** App mit Lead-Sync-API-Zugang, Webhook auf `https://intranet.grid-agency.de/api/webhooks/linkedin` registrieren und für die Lead-Formulare des Ad-Accounts abonnieren. Der Access Token braucht `r_marketing_leadgen_automation`.

**DATEV:** Upload-Adresse (`…@uploadmail.datev.de`) in Finance → Einstellungen eintragen. „An DATEV senden“ holt die Anhänge der Rechnungsmail und schickt sie von buchhaltung@ an diese Adresse.

**Bank (Enable Banking):** Unter [enablebanking.com](https://enablebanking.com) eine Production-App anlegen (eigene Konten verbinden ist ohne Vertrag möglich), Redirect-URL `https://intranet.grid-agency.de/api/finance/bank/callback` eintragen (für lokal zusätzlich `http://localhost:3000/api/finance/bank/callback`). App-ID als `ENABLE_BANKING_APP_ID`, den privaten Schlüssel (PEM) als `ENABLE_BANKING_PRIVATE_KEY` in Vercel. Dann in Finance → Bank „Konto verbinden“ → Commerzbank, Geschäftskonto → Login und photoTAN. Die Freigabe gilt bis zu 180 Tage; die Seite warnt zwei Wochen vorher, dann „Neu verbinden“ (Umsätze bleiben). Der Cron holt täglich Saldo und gebuchte Umsätze und ordnet automatisch zu, wenn Betrag und Rechnungsnummer (Eingangsrechnungen: oder Rechnungssteller) im Verwendungszweck passen. Zahlungseingänge werden in easybill als Zahlung gebucht; „Zuordnung lösen“ löscht sie dort wieder.

**Mail-Abos:** Der Cron (täglich, `vercel.json`) legt je Postfach ein Graph-Abo an und verlängert es. Zum Start einmal manuell aufrufen:
`curl -H "Authorization: Bearer $CRON_SECRET" https://intranet.grid-agency.de/api/cron/mail`
