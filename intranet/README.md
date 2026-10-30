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
- `/finance` – Eingangsrechnungen als Kanban (Neu → Freigegeben → An DATEV gesendet), Ausgangsrechnungen (Rechnungen, Gutschriften, Stornos, Serien und Angebote schreiben und verschicken; dazu alle Belege aus easybill), Bank (nur Admins: Saldo und Umsätze des Firmenkontos, Abbuchungen ↔ Eingangsrechnungen, Zahlungseingänge ↔ Ausgangsrechnungen), Posteingang von buchhaltung@, Einstellungen (DATEV-Upload-Adresse, Firmendaten, Texte und Agenturvertrag)
- `/personal` – Bewerbungen als Kanban (Neue Bewerbung → Gespräch → Case Study → Zusage / Absage)
- `/mail` – Posteingang und Kalender aller Postfächer (hello@, giulia@, buchhaltung@, google@)
- `/aufgaben` – To-dos je Kunde (ersetzt Asana): Kacheln aller Kunden, je Kunde eine Liste wie in Asana (Themen als Gruppen, alles direkt in der Zeile bearbeitbar, speichert automatisch), „Meine To-dos“ über alle Kunden, Briefing je Kunde (Zugänge, Ansprechpartner, Postingplan), ehemalige Kunden im Archiv
- `/admin` – Admin-Konsole (nur Rolle Admin): Passwort-Tresor (Kunden-Zugänge sehen alle mit Aufgaben, interne nur Admins; AES-256-GCM-verschlüsselt, Anzeigen/Kopieren/Ändern im Protokoll), Benutzer & Rechte (wer ins Intranet darf, Rolle Admin oder Mitarbeiter*in mit freigegebenen Bereichen; Tabelle `intranet_users`), Firmendaten, Absender & Updates, Protokoll

Teams: Über das Sprechblasen-Symbol (Hub oben rechts, Seitenleiste „Teams“) öffnen sich die eigenen Teams-Chats: lesen, antworten, neuer 1:1-Chat mit dem Team. Aus einem To-do heraus schickt „Per Teams schicken“ es an die zuständige Person (Nachricht vorausgefüllt, gesendet wird erst auf Knopfdruck). Alles läuft mit dem Microsoft-Login der Person (`Chat.ReadWrite`), Nachrichten kommen also von ihr selbst.

Kunden-Updates (Admin → Absender & Updates): Ein eigenes Microsoft-365-Konto (z. B. eine Mitarbeiterin fürs Kunden-Update) wird einmal verbunden; der Server hält dessen Refresh-Token mit `VAULT_KEY` verschlüsselt. Je Kunde wird ein Teams-Chat dieses Kontos zugeordnet und Wochen-Update und/oder Reporting eingeschaltet. Claude schreibt die Texte aus den Aufgaben (nur Titel, keine Notizen, nichts Internes) und schickt sie automatisch: Wochen-Update freitags um 14/15 Uhr, Reporting für den Vormonat am ersten Werktag (`GET /api/cron/updates`, `vercel.json`). Pro Kunde, Art und Zeitraum geht höchstens eine Nachricht raus; ohne `ANTHROPIC_API_KEY` gar keine. Vorschau, Senden von Hand, Verlauf (`customer_updates`) und Antworten im Kundenchat stehen auf derselben Seite. Social-Media-Zahlen im Reporting folgen, sobald die Plattform-APIs angebunden sind.

Zugang: Nur Microsoft-Konten, die in Admin → Benutzer & Rechte aktiv sind, kommen hinein. Jede API-Route prüft das (`withUser` in `src/lib/server/auth.ts`); welche Tabelle zu welchem Bereich gehört, steht in `TABLE_AREAS` in `src/lib/server/db.ts`. Aufgaben-Listen mit `restricted` (z. B. „Geschäftsführung“) sehen nur Admins.

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
- `ANTHROPIC_API_KEY`: ohne Key ordnen einfache Stichwort-Regeln die Mails ein, und es gehen keine Kunden-Updates raus.
- `VAULT_KEY`: Schlüssel des Passwort-Tresors, 32 Byte base64 (`openssl rand -base64 32`). Nie ändern oder löschen, sonst lassen sich gespeicherte Passwörter nicht mehr entschlüsseln. Bis er gesetzt ist, liegen die aus Asana übernommenen Passwörter unverschlüsselt vor; beim ersten Öffnen von Admin danach werden sie automatisch verschlüsselt.
- `EASYBILL_API_KEY`: easybill → Einstellungen → API. Damit gleicht das Intranet Kunden, Artikel, Serienrechnungen (→ Retainer) und offene Angebote (→ Leads in „Angebot“) ab, täglich und per Knopf „easybill“ in Kunden, Auftragsbuch und Artikel.
- `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_PRIVATE_KEY`: Bankanbindung (Finance → Bank), siehe unten.
- `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`
- `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`

**Microsoft Entra** (App „GRID Intranet“):

1. API-Berechtigungen, delegiert: `Mail.ReadWrite.Shared`, `Mail.Send.Shared`, `Calendars.ReadWrite.Shared` (Posteingang und Kalender im Sales), `Chat.ReadWrite` (Teams-Chats), `User.ReadBasic.All` (Profilbilder). Nach Möglichkeit Administratorzustimmung erteilen, sonst stimmt jede Person beim ersten Mal selbst zu.
2. Anwendungsberechtigung `Mail.ReadWrite` mit Administratorzustimmung (Mail-Eingang; erkannte Rechnungen werden je Postfach in den Ordner „Eingangsrechnungen“ verschoben). Am besten per Application Access Policy auf die Postfächer aus `MAILBOXES` beschränken.
3. Unter „Zertifikate & Geheimnisse“ ein Client-Secret anlegen und als `MS_CLIENT_SECRET` hinterlegen.
4. Exchange: Vollzugriff und „Senden als“ auf jedes geteilte Postfach aus `MAILBOXES` (hello@, buchhaltung@, google@). Der DATEV-Versand läuft über „Senden als“ von buchhaltung@.
5. SPA-Redirect-URIs: jede Intranet-URL mit `/` am Ende (Produktion, Previews, `http://localhost:3000/`).
6. Plattform „Web“ mit der Redirect-URI `https://intranet.grid-agency.de/api/sender/callback` (Absender-Konto für Kunden-Updates; nutzt `MS_CLIENT_SECRET`).

**Meta:** In der Meta-App das Webhook-Produkt „Page“ mit Feld `leadgen` auf `https://intranet.grid-agency.de/api/webhooks/meta` einrichten (Verify Token = `META_VERIFY_TOKEN`). Die App braucht die Rechte `leads_retrieval` und `pages_manage_metadata` und einen Page Access Token.

**LinkedIn:** App mit Lead-Sync-API-Zugang, Webhook auf `https://intranet.grid-agency.de/api/webhooks/linkedin` registrieren und für die Lead-Formulare des Ad-Accounts abonnieren. Der Access Token braucht `r_marketing_leadgen_automation`.

**DATEV:** Upload-Adresse (`…@uploadmail.datev.de`) in Finance → Einstellungen eintragen. „An DATEV senden“ holt die Anhänge der Rechnungsmail und schickt sie von buchhaltung@ an diese Adresse.

**Bank (Enable Banking):** Unter [enablebanking.com](https://enablebanking.com) eine Production-App anlegen (eigene Konten verbinden ist ohne Vertrag möglich), Redirect-URL `https://intranet.grid-agency.de/api/finance/bank/callback` eintragen (für lokal zusätzlich `http://localhost:3000/api/finance/bank/callback`). App-ID als `ENABLE_BANKING_APP_ID`, den privaten Schlüssel (PEM) als `ENABLE_BANKING_PRIVATE_KEY` in Vercel. Dann in Finance → Bank „Konto verbinden“ → Commerzbank, Geschäftskonto → Login und photoTAN. Die Freigabe gilt bis zu 180 Tage; die Seite warnt zwei Wochen vorher, dann „Neu verbinden“ (Umsätze bleiben). Der Cron holt um 8:30, 11, 15 und 20 Uhr (deutsche Zeit) Saldo und gebuchte Umsätze und ordnet automatisch zu, wenn Betrag und Rechnungsnummer (Eingangsrechnungen: oder Rechnungssteller) im Verwendungszweck passen. Zahlungseingänge werden als Zahlung an der Ausgangsrechnung gebucht (`billing_payments`, Status offen → teilbezahlt/bezahlt); „Zuordnung lösen“ nimmt sie wieder heraus.

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

## Pipeline (Sales)

Vier Spalten, jede mit dem nächsten Schritt direkt an der Karte:

- **Neuer Lead**: „Termin einladen“ schickt von hello@ eine Mail mit persönlichem Buchungslink (`grid-agency.de/termin?l=…`, nur der SHA-256 liegt am Lead). „Absage“ nimmt den Lead mit Grund (z. B. Spam) aus der Pipeline.
- **Erstgespräch**: Leads buchen selbst auf der Website (Buchungsfenster bzw. `/termin`, mit oder ohne Einladung). Freie 30-Minuten-Slots Mo–Fr 10–17 Uhr ab morgen, 3 Wochen, 15 Min Puffer, aus dem Kalender von `BOOKING_MAILBOX` (Standard giulia.cavallino@). Die Buchung legt den Teams-Termin an (Outlook lädt ein), legt den Lead an bzw. findet ihn per E-Mail und schiebt ihn hierher. Nach dem Gespräch: „Angebot erstellen“ (Kunde, Leistungen, Vertrag, SEPA, Unterschrift) → „Abschicken“ legt den Kunden an, schreibt das Angebot fest und schickt die Mappe von hello@.
- **Angebot verschickt**: Die Unterschrift auf sign.grid-agency.de schiebt den Lead automatisch auf „Kunde gewonnen“, eine Ablehnung nimmt ihn als verloren heraus.
- **Kunde gewonnen**: „Onboarding starten“ legt in Aufgaben den Abschnitt „Onboarding“ mit Standard-To-dos an, erzeugt die Serienrechnung aus den monatlichen Positionen des Angebots (ab Vertragsbeginn, läuft sofort) und schickt die Einladung zum Kick-off (60 Min, Buchungslink).

Kontaktformular und Buchung der Website gehen über `/api/public/kontakt` und `/api/public/termin` des Intranets und sind mit ALTCHA geschützt (Proof of Work, `src/lib/server/altcha.ts`; Schlüssel `ALTCHA_HMAC_KEY` oder aus dem Service-Key abgeleitet, jede Lösung gilt einmal). Braucht in Entra die Anwendungsberechtigungen `Calendars.ReadWrite` und `Mail.Send`.

## Angebote und Unterschrift (sign.grid-agency.de)

Ein Angebot geht als Mappe zur Unterschrift: Angebot, Agenturvertrag (Text aus dem easybill-„Auftrag“, in Finance → Einstellungen bearbeitbar, Platzhalter wie `{Mindestlaufzeit}`) und optional SEPA-Lastschriftmandat.

- **Ablauf**: Angebot schreiben → Fertigstellen (eigener Nummernkreis `angebot`) → „Zur Unterschrift senden“. GRID unterschreibt dabei vorab (Unterschrift wird gespeichert), die Mail mit Link geht von hello@ über Graph im Browser.
- **Kunde**: Der Link `https://sign.grid-agency.de/s/<token>` zeigt zuerst das Angebot (mit Zahlungsart SEPA-Lastschrift). Nach „Angebot annehmen“ erstellt der Kunde einmal seine Unterschrift (zeichnen oder tippen) und klickt sich dann wie bei DocuSign mit „Start“/„Weiter“ durch die markierten Felder in Angebot, Vertrag und SEPA-Mandat. Jede gesetzte Unterschrift bekommt eine eigene Prüf-ID, die im PDF unter der Unterschrift und im Abschlussprotokoll steht; die GRID-Unterschrift hat eine aus der Mappe abgeleitete Prüf-ID. Der Token liegt nur als SHA-256-Hash in `sign_envelopes`, Links laufen nach 30 Tagen ab, ein neuer Versand zieht offene Mappen zurück. Auf `sign.*` lässt `src/proxy.ts` nur `/s/`, `/t/` (Terminwahl Bewerbungen) und ihre APIs durch.
- **Abschluss**: Das Gesamt-PDF mit Protokoll (Ereignisse, IP, SHA-256 vor der Unterschrift) wird mit einem PAdES-Siegel versehen (`src/lib/server/seal.ts`). Das Siegel-Zertifikat ist selbst ausgestellt, wird beim ersten Gebrauch erzeugt und im Supabase Vault gespeichert; ein gekauftes Zertifikat lässt sich über `SIGN_P12_BASE64`/`SIGN_P12_PASSWORD` setzen. Das PDF landet in der Kundenakte (`customer_documents`, Bucket `billing`), das Angebot steht auf „angenommen“, das SEPA-Mandat am Kunden.
- **Abschlussmail** an den Kunden und an hello@ mit dem PDF: braucht wie die Serien die **Anwendungsberechtigung `Mail.Send`**. Fehlt sie, steht der Fehler an der Mappe; das PDF ist trotzdem in der Kundenakte.
- **SEPA** setzt die **Gläubiger-ID** in Finance → Einstellungen voraus.

### Bewerbungen: Einladung zum Vorstellungsgespräch

- **Ein Klick** auf „Einladen“ an der Bewerbungskarte (oder im Detail) schickt von hello@ eine Mail mit Button „Termin wählen“ und schiebt die Karte nach „Gespräch“. Der Termin kommt in den Kalender der Person, die geklickt hat.
- **Terminwahl** unter `https://sign.grid-agency.de/t/<token>`: nur über den Link aus der Einladung, keine offene Buchung auf der Website. Freie Slots: Mo–Fr 9–17 Uhr (Berlin), 30 Minuten, ab 18 Stunden Vorlauf, 14 Tage im Voraus, gegen Frei/Gebucht im Outlook-Kalender geprüft. Die Buchung legt eine Teams-Besprechung an (Outlook schickt die Einladung an die Person) und trägt Datum und Teams-Link an der Karte ein. Der Token liegt nur als SHA-256-Hash in `applications.invite_token_hash`; „Erneut senden“ ersetzt den alten Link.
- Braucht die **Anwendungsberechtigungen `Calendars.ReadWrite`** (Frei/Gebucht lesen, Termin anlegen) und **`Mail.Send`** mit Admin-Zustimmung. Fehlt der Kalenderzugriff, sagt die Terminseite, dass man auf die Mail antworten soll.
