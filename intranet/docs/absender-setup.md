# Kunden-Updates aktivieren (Absender & Updates)

Das Intranet schickt freitags ein Wochen-Update (14 Uhr, im Sommer 15 Uhr) und am ersten Werktag des Monats ein Reporting in die Teams-Chats der Kunden. Gesendet wird über das Microsoft-365-Konto von Sophia Conti, das unter **Admin → Absender & Updates** verbunden wird.

Solange etwas fehlt, sind die Updates **pausiert**:

- Es wird nichts gesendet, und Claude wird nicht aufgerufen.
- Der Cron schreibt nichts ins Protokoll.
- Admin → Absender & Updates zeigt, was noch fehlt.

Ohne `VAULT_KEY` bleibt außerdem der Passwort-Tresor, wie er ist: Die aus Asana übernommenen Passwörter bleiben unverschlüsselt, und neue Passwörter lassen sich nicht speichern.

## Schon erledigt

- Entra-App „GRID Intranet“: Plattform „Web“ mit der Redirect-URI `https://intranet.grid-agency.de/api/sender/callback`.
- Delegierte Berechtigungen `Chat.ReadWrite`, `User.Read`, `User.ReadBasic.All`, `offline_access`, `openid` und `profile`, mit Administratorzustimmung.
- In Vercel gesetzt: `MS_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `INTRANET_URL`.

## 1. Absender-Konto mit Teams-Lizenz (Sophia Conti)

Die Updates gehen von **Sophia Conti** (`sophia.conti@grid-agency.de`) aus. Heute ist `sophia.conti@grid-agency.de` nur ein **geteiltes Postfach**. Damit geht es nicht: Ein geteiltes Postfach kann sich nicht anmelden und nicht Mitglied in Teams-Chats sein. So wird daraus ein Konto, das senden kann:

1. Exchange Admin Center (admin.exchange.microsoft.com) → Empfänger → Postfächer → `sophia.conti@grid-agency.de` → **In reguläres Postfach konvertieren**. Die vorhandenen Mails bleiben erhalten.
2. admin.microsoft.com → Benutzer → Aktive Benutzer → Sophia Conti:
   - **Anmeldung zulassen**.
   - Das **Passwort zurücksetzen**.
   - Eine **Lizenz mit Teams** zuweisen, z. B. Microsoft 365 Business Basic.
3. Einmal als `sophia.conti@grid-agency.de` anmelden, ein eigenes Passwort setzen und MFA einrichten.
4. Das Passwort im Passwort-Manager speichern, nicht im Intranet-Tresor.

Wer bisher Zugriff auf das geteilte Postfach hatte, behält ihn: Die Postfachberechtigungen bleiben bei der Konvertierung bestehen.

## 2. VAULT_KEY anlegen und sichern

1. Lokal einen Schlüssel erzeugen:

   ```bash
   openssl rand -base64 32
   ```

2. In Vercel → Team grid-agency → Projekt **grid-intranet** → Settings → Environment Variables eine neue Variable anlegen:
   - Name: `VAULT_KEY`
   - Environments: Production und Preview
   - Typ: **Sensitive**
3. Den Schlüssel zusätzlich **außerhalb des Intranets** sichern, z. B. im Passwort-Manager unter „GRID Intranet VAULT_KEY (nie ändern)“. Vercel zeigt Sensitive-Werte später nicht mehr an.
4. **Nie ändern oder löschen.** Ohne den Schlüssel lassen sich die gespeicherten Passwörter und die Verbindung des Absender-Kontos nicht mehr entschlüsseln.

## 3. Redeploy

In Vercel → grid-intranet → Deployments beim letzten Production-Deployment „Redeploy“ wählen und warten, bis es „Ready“ ist. Erst danach kennt die App den Schlüssel.

Beim nächsten Öffnen von **Admin → Passwörter** werden die übernommenen Passwörter automatisch verschlüsselt. Der Hinweis „VAULT_KEY fehlt“ verschwindet dann.

## 4. Absender verbinden

1. `sophia.conti@grid-agency.de` in Teams in die Gruppenchats der aktiven Kunden aufnehmen: Huck, 480 Gradi, Asia De Saleh, Casualfood. Den Chatverlauf nicht teilen.
2. Im Intranet (als Admin) **Admin → Absender & Updates** öffnen. Die Liste unter „Updates pausiert“ zeigt, was noch fehlt.
3. `sophia.conti@grid-agency.de` eintragen und **Mit Microsoft verbinden** klicken. Im Microsoft-Fenster „Anderes Konto verwenden“ wählen, als Sophia Conti anmelden und zustimmen.
4. Danach steht Sophia Conti oben als verbunden, und der Hinweis „Updates pausiert“ verschwindet.

## 5. Chats zuordnen

Für jeden Kunden unter „Kunden“:

- Den passenden Teams-Chat im Auswahlfeld wählen.
- **Wochen-Update** und/oder **Reporting** einschalten.

Archivierte Kunden und die Liste „Geschäftsführung“ erscheinen hier nicht.

## 6. Vorschau prüfen

- Je Kunde **Vorschau** öffnen. Claude schreibt den Text aus den Aufgaben des Zeitraums; er erscheint dort, wird aber nicht gesendet.
- Darf nicht vorkommen: Rechnungen, Zahlungen, Zugänge, Passwörter, Interna oder Namen von Mitarbeitenden.
- Taucht so etwas auf, die Schalter für diesen Kunden ausschalten und die Aufgaben-Titel anpassen.
- „Jetzt senden“ ist nur für Ausnahmen gedacht. Normalerweise sendet der Cron automatisch, höchstens eine Nachricht pro Kunde, Art und Zeitraum.
- Unter „Verlauf“ steht, was rausging oder warum nicht.

## Pausieren

- Einzelne Kunden: Schalter ausschalten.
- Alles: unter Absender & Updates **Trennen**. Danach geht nichts mehr raus, bis wieder ein Konto verbunden ist.
