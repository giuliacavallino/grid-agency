# Marketing Hub: Kundenwelten, Canva und Social Media

Der Marketing Hub (`/marketing`) ist die Steuerzentrale, um GRID und alle Kunden zu bespielen. Jeder Kunde hat eine eigene **Kundenwelt** mit:

- eigener CI (Logo, Hauptfarbe, Zweitfarbe),
- eigenen Kanälen,
- eigenen Posts,
- einem eigenen SharePoint-Ordner.

Oben in der Übersicht wechselt das Auswahlfeld „GRID AGENCY ▾“ in die Welt eines Kunden.

## CI-Welt je Kunde (Vorgabe für den Agenten)

Unter Marketing → **CI & Vorgaben** liegt für jede Kundenwelt:

- **Farben** mit Rolle (Primär, Sekundär, Akzent …). Die Primär- und die Sekundärfarbe färben auch die Kundenwelt im Hub.
- **Logos** in Varianten (Hauptlogo, Negativ, Icon, Wortmarke). Das Hauptlogo erscheint im Hub.
- **Schriften**.
- **Tonalität**, **Zielgruppe** und **Bildsprache**.
- **Dos & Don'ts**.
- **Hashtags**.
- **Weitere Hinweise**.

„Mit Claude vorschlagen“ liest das Briefing aus Aufgaben und die Website des Kunden und schlägt Tonalität, Dos & Don'ts, Bildsprache und Hashtags vor. Farben und Schriften übernimmt Claude nur, wenn sie in den Unterlagen stehen. Übernommen wird erst nach Prüfung.

Daraus entsteht eine Vorgabe als Text. Der Agent holt sie vor jedem Design und Post mit `GET /api/marketing/workspaces/{id}/brand` (Feld `brief`) und hält sich daran. Ändern darf die CI-Welt nur das Team.

## Wie Kunden ihre Kanäle verbinden

GRID hat pro Plattform **eine** Entwickler-App (Meta, LinkedIn, TikTok). Diese wird einmal angelegt und einmal von der Plattform freigegeben (App Review). Danach braucht kein Kunde mehr eigene API-Rechte:

1. Unter Marketing → Kanäle in der Kundenwelt auf **„Link für Kunden“** klicken. Der Link ist 14 Tage gültig.
2. Der Kunde öffnet den Link (`intranet.grid-agency.de/verbinden/…`) und meldet sich bei Instagram/Facebook, LinkedIn oder TikTok an. Dort klickt er „Erlauben“.
3. Die Zugänge landen verschlüsselt (`VAULT_KEY`) in seiner Kundenwelt. Ab dann posten Team und Agent dort.

Alternativ meldet sich jemand von GRID mit **„Selbst verbinden“** an, wenn GRID schon Admin-Zugriff auf die Seiten des Kunden hat.

## Einmalige Einrichtung

Alle Rücksprung-Adressen enden auf `https://intranet.grid-agency.de/api/social/callback/<anbieter>`.

| Was | Wo | Vercel-Variablen |
| --- | --- | --- |
| Canva | canva.dev → Your integrations → Integration anlegen (Connect API) | `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET` |
| Meta (Facebook + Instagram) | developers.facebook.com → App „GRID Intranet“ (vom Lead-Eingang) | `META_APP_ID` (neu), `META_APP_SECRET` (vorhanden) |
| LinkedIn | developer.linkedin.com → **neue** App, nur Produkt „Community Management API“ | `LINKEDIN_CM_CLIENT_ID`, `LINKEDIN_CM_CLIENT_SECRET` |
| TikTok | developers.tiktok.com → App mit Login Kit + Content Posting API | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| SharePoint | Website für die Ablage, z. B. `gridagency.sharepoint.com:/sites/GRID` | `SHAREPOINT_SITE`, optional `SHAREPOINT_FOLDER` (Standard `Kundenwelten`) |
| Agent | Langer Zufallswert, mindestens 32 Zeichen | `AGENT_API_KEY` |

Alle Werte in Vercel als „Sensitive“ anlegen, für Production und Preview. Danach ein Redeploy auslösen.

### Canva

- Scopes: `design:content:read`, `design:content:write`, `design:meta:read`, `asset:read`, `asset:write`, `folder:read`, `folder:write`, `profile:read`.
- Redirect-URL: `…/api/social/callback/canva`.
- Danach in Marketing → Kundenwelten „Canva verbinden“ klicken, mit dem GRID-Canva-Konto.
- Mit Canva Pro/Teams gehen: Designs anlegen, Assets hochladen und exportieren (PNG, JPG, MP4, PDF). Vorlagen automatisch befüllen (Autofill) gibt es nur mit Canva Enterprise.

### Meta

- In der App „Facebook Login for Business“ hinzufügen, Redirect-URI `…/api/social/callback/meta`.
- Berechtigungen: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`.
- Für fremde Seiten (Kunden) ist **App Review** mit „Advanced Access“ für diese Berechtigungen und die Business-Verifizierung nötig. Bis dahin funktionieren nur Seiten von Personen mit einer Rolle in der App.
- Instagram muss ein Business- oder Creator-Konto sein, das mit einer Facebook-Seite verknüpft ist.

### LinkedIn

- LinkedIn verlangt für die „Community Management API“ eine **eigene App**, in der nur dieses Produkt aktiv ist. Darum gibt es eigene Keys neben der Lead-Sync-App.
- Redirect-URL: `…/api/social/callback/linkedin`.
- Scopes: `r_organization_social`, `w_organization_social`, `rw_organization_admin`, `w_member_social`.
- Ein Login verbindet das **persönliche Profil** der Person (z. B. Giulia) und **alle Unternehmensseiten**, auf denen sie Admin ist (z. B. GRID). Beide erscheinen als eigene Kanäle und lassen sich in Posts auswählen.
- Bis LinkedIn die App freigibt (Development Tier), gehen nur Seiten, auf denen das verbindende Konto Admin ist. Für Kundenseiten ist der Standard Tier nötig (Antrag mit Screencast im Developer Portal).
- Der Zugang gilt 60 Tage. Wenn LinkedIn Refresh-Tokens freischaltet, erneuert der Hub ihn selbst, sonst erscheint „neu verbinden“.
- Optional `LINKEDIN_API_VERSION` (z. B. `202607`). Standard ist der Monat vor drei Monaten.

### TikTok

- Produkte: Login Kit und Content Posting API (Direct Post).
- Redirect-URI: `…/api/social/callback/tiktok`.
- Scopes: `user.info.basic`, `video.publish`, `video.upload`.
- Unter „URL properties“ die Domain `intranet.grid-agency.de` bestätigen. TikTok holt Foto-Posts per URL von dort.
- Bis zum **Audit** durch TikTok sind Posts nur privat sichtbar (SELF_ONLY).

### SharePoint

- Die Entra-App „GRID Intranet“ braucht die Anwendungsberechtigung **Sites.Selected** (empfohlen) mit Administratorzustimmung und eine Freigabe für die eine Website (Rolle „write“), oder alternativ **Sites.ReadWrite.All**.
- Jede Kundenwelt bekommt `Kundenwelten/<Kunde>/<JJJJ-MM>/`. Alle Bilder und Videos eines Posts werden dort zusätzlich abgelegt.
- „SharePoint“ auf der Kanäle-Seite öffnet den Ordner und legt ihn bei Bedarf an.

## Bildbearbeitung

Rohbilder bearbeitet man im Post-Dialog: ein Klick auf ein Bild öffnet den Editor. Der Agent nutzt dieselben Funktionen über die Schnittstelle. Das Original bleibt erhalten; das Ergebnis ist ein neues Medium.

| Werkzeug | Was | Schlüssel |
| --- | --- | --- |
| Im Intranet (sharp) | Zuschnitt auf 4:5, 9:16, 1:1, 16:9 und 1.91:1, wobei der Ausschnitt automatisch dem Motiv folgt; Helligkeit, Kontrast, Sättigung, Schärfen; Logo aus der CI-Welt als Wasserzeichen; Ausgabe als JPG, PNG oder WebP | keiner |
| Photoroom | Hintergrund entfernen (freistellen) oder per KI ersetzen, z. B. „Holztisch in warmem Tageslicht“; ideal für Produkt- und Food-Fotos | `PHOTOROOM_API_KEY` (photoroom.com → API, Plan „Plus“ für KI-Hintergründe) |
| Claid.ai | Rohbilder automatisch verbessern (Licht, Farbe, Rauschen, Schärfe), hochskalieren, auf das Format zuschneiden | `CLAID_API_KEY` (claid.ai → API Keys) |

Kamera-RAW-Dateien (CR3, NEF, ARW, DNG) vorher als JPG oder TIFF exportieren, z. B. aus Lightroom. Mit Adobe-Firefly-Services ließen sich später auch RAW-Dateien und Lightroom-Presets per API bearbeiten; dafür ist ein Adobe-Enterprise-Vertrag nötig.

Endpunkte für den Agenten:

- `POST /api/marketing/image/edit`: `{ path, format, brightness, contrast, saturation, sharpen, logo: { workspace_id, position } }`
- `POST /api/marketing/image/background`: `{ path, background_color? | background_prompt? }`
- `POST /api/marketing/image/enhance`: `{ path, upscale?, format? }`

Jeder Endpunkt liefert ein neues Medium (`path`, `url`), das direkt in einen Post kann.

## Video-Werkzeuge

Für die Video-Werkzeuge braucht es nur je einen API-Schlüssel, keine App-Prüfung. Jeden Schlüssel in Vercel als „Sensitive“ anlegen, danach ein Redeploy auslösen. Was angebunden ist, zeigt Marketing → Agent & API.

| Werkzeug | Wofür | Konto und Schlüssel | Vercel-Variable |
| --- | --- | --- | --- |
| Creatomate | Videos aus Vorlagen rendern (Motion Design), schneiden/kürzen, Untertitel einbrennen, Musik unterlegen; ersetzt ffmpeg | creatomate.com → Project settings → API Key | `CREATOMATE_API_KEY` |
| OpenAI Whisper | Transkript und Untertitel (SRT/VTT) aus Video oder Audio, bis 25 MB | platform.openai.com → API keys (eigenes Projekt „GRID Intranet“) | `OPENAI_API_KEY` |
| ElevenLabs | Voiceover (Text → Sprache) in der Stimme der Kundenwelt, Musik aus einer Beschreibung | elevenlabs.io → Profile → API Keys (Rechte: Text to Speech, Voices, Music) | `ELEVENLABS_API_KEY`, optional `ELEVENLABS_MODEL` |

So arbeitet der Agent damit:

1. **Motion Design:** Vorlagen werden einmal im Creatomate-Editor gebaut, je Kunde in seiner CI (z. B. „Reel 9:16 Huck“). Der Agent füllt sie mit `POST /api/marketing/video/render` und `{ template_id, modifications }`: Texte, Bilder, Video, Musik.
2. **Schneiden:** `POST /api/marketing/video/render` mit `{ source }` (RenderScript). Ein Video-Element mit `trim_start` und `trim_duration` kürzt, mehrere Elemente hintereinander ergeben einen Zusammenschnitt.
3. **Untertitel:** `POST /api/marketing/video/transcribe` mit `{ path, format: "srt" }`. Den Text dann als Untertitel in die Vorlage geben. Creatomate kann Untertitel auch selbst erzeugen.
4. **Voiceover:** `POST /api/marketing/video/voiceover` mit `{ text, workspace_id }`. Ohne `voice_id` gilt die Stimme aus der CI-Welt (CI & Vorgaben → Stimme).
5. **Musik:** `POST /api/marketing/video/music` mit `{ prompt, seconds }`.
6. **Fertigstellen:** `GET /api/marketing/video/render/{id}?store=1` liefert das fertige Video als `media`. Damit geht es weiter mit `POST /api/marketing/posts`.

Artlist hat keine öffentliche Schnittstelle, die ein Agent nutzen könnte. Musik kommt deshalb von ElevenLabs. Lizenzierte Artlist-Tracks lädt das Team selbst herunter und legt sie als Medien ab.

## Veröffentlichen

- **Jetzt posten:** geht sofort an alle gewählten Kanäle. Das Ergebnis steht pro Kanal am Post.
- **Planen:** Der Cron `/api/cron/social` läuft stündlich zwischen ca. 7 und 22 Uhr und postet alles Fällige.
- Ein erneuter Versuch postet nur dort, wo es fehlgeschlagen ist.
- Was jede Plattform kann:
  - **Instagram:** Bild, Karussell (bis 10) oder Reel. Text allein geht nicht.
  - **Facebook:** Text, Bild, mehrere Bilder oder Video.
  - **LinkedIn:** Text oder Bilder, als Seite oder persönliches Profil. Videos folgen.
  - **TikTok:** Video oder Foto-Post.

## Community Management (LinkedIn)

Marketing → **Community** zeigt die Kommentare unter den letzten 10 Posts jeder verbundenen LinkedIn-Unternehmensseite, dazu Antworten in Gesprächen, in denen wir in den letzten 7 Tagen geantwortet haben.

- **Abruf:** stündlich mit dem Cron `/api/cron/social`, sofort mit „Jetzt abrufen“. Beim ersten Abruf gelten alle vorhandenen Kommentare als „älter“ und werden nicht beantwortet.
- **Autopilot** (je Seite, Standard an): Claude liest CI-Vorgabe, Post und Gesprächsverlauf und entscheidet selbst. Normale Kommentare beantwortet er sofort im Namen der Seite, Spam bleibt ohne Antwort, Heikles (Beschwerden, Preise, Recht, Bewerbungen …) landet unter „Fürs Team“ mit einem Antwortvorschlag. Braucht `ANTHROPIC_API_KEY`.
- **Kommentieren:** „Post kommentieren“ kommentiert beliebige Posts als Seite oder als Person (Adresse des Posts einfügen).
- **Persönliches Profil:** Posten und Kommentieren gehen. Kommentare unter eigenen Profil-Posts gibt LinkedIn per Schnittstelle nicht heraus (`r_member_social` ist gesperrt); die beantwortet man in LinkedIn selbst.

## Outreach (Nachrichten und Kontaktanfragen)

LinkedIn gibt Nachrichten (Messages API) und Kontaktanfragen (Invitations API) nur ausgewählten Partnern frei. Tools, die das per Browser-Cookie automatisieren, verstoßen gegen die Nutzervereinbarung und riskieren die Sperre des Profils. Darum:

1. Der Agent legt Entwürfe an: `POST /api/marketing/outreach` mit `{ workspace_id, kind: "message" | "invitation", recipient, profile_url, text, context? }`. Notizen zu Kontaktanfragen höchstens 300 Zeichen (ohne Premium sind nur wenige Notizen pro Monat möglich).
2. Unter Marketing → **Outreach** prüft das Team, klickt „Kopieren & öffnen“, fügt den Text auf LinkedIn ein und markiert den Entwurf als gesendet.

## Agent

Der Agent nutzt dieselbe Schnittstelle wie die Oberfläche und meldet sich mit `Authorization: Bearer <AGENT_API_KEY>` an. Kanäle verbinden oder trennen darf nur das Team.

Typischer Ablauf:

```text
GET  /api/marketing/workspaces                → Kundenwelt + account_ids wählen
GET  /api/marketing/workspaces/{id}/brand      → CI-Vorgabe (brief) lesen und befolgen
POST /api/marketing/canva/designs              { title, width: 1080, height: 1350, workspace_id }
     (Design in Canva gestalten oder aus Vorlage)
POST /api/marketing/canva/export               { design_id, format: "png" }  → media[]
POST /api/marketing/posts                      { workspace_id, caption, media, account_ids,
                                                 scheduled_at: "2026-11-03T17:00:00+01:00" }
                                               oder publish_now: true
GET  /api/marketing/posts?workspace=…          → Status und Ergebnisse je Kanal
GET  /api/marketing/comments?workspace=…&status=needs_human → was das Team klären muss
POST /api/marketing/comments/{id}              { text }  → antworten
POST /api/marketing/linkedin/comment           { account_id, post, text } → fremde Posts kommentieren
POST /api/marketing/outreach                   { workspace_id, kind, recipient, profile_url, text }
```

Eigene Dateien: `POST /api/marketing/media` mit `{ url }` oder als Datei bis 4 MB. Größere Dateien über `POST /api/marketing/media/upload-url`, dann per PUT an die gelieferte Adresse.

Alle Endpunkte stehen auch in Marketing → Agent & API.
