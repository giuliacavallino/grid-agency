# Marketing Hub: Kundenakten, Agent und Social Media

Jeder Kunde (und GRID selbst) hat eine **Kundenakte** unter `/akte/<id>`. Geöffnet wird sie über das Auswahlfeld „GRID AGENCY ▾“ in der Übersicht. Gewechselt wird nur dort, nicht innerhalb der Akte. `/marketing` öffnet die Akte von GRID; die alten Adressen leiten weiter.

Die Akte trägt Logo und CI-Farben des Kunden. In der Seitenleiste:

| Bereich | Inhalt |
|---|---|
| Cockpit | Kennzahlen, Posts vorschlagen, neue Vorschläge, die nächsten 7 Tage, To-dos (auch beim Agenten), letzter Call, Autopilot, Kanäle |
| Aufgaben | Aufgabenliste des Kunden mit Briefing; jedes To-do lässt sich „An Agent übergeben“ |
| Calls & To-dos | Zusammenfassungen und To-dos aus Calls mit diesem Kunden: übernehmen oder direkt an den Agenten |
| Vorschläge | Trend-Recherche und fertige Posts mit CI-Grafik |
| Planung | Redaktionskalender mit Editor |
| CI & Agent | CI-Welt als verbindliche Vorgabe |
| Einstellungen (unten) | Diese Akte: Kanäle, Autopilot, Stammdaten (Name, Farben, Logo, Aufgabenliste, SharePoint). Marketing Hub: Anbindungen, Kundenakten, Agent & API |

Neue Kundenakten bekommen automatisch eine eigene Aufgabenliste.

## Posts vorschlagen

„Vorschläge erstellen“ (Cockpit oder Vorschläge) läuft in zwei Schritten:

1. Claude recherchiert mit der Websuche (`web_search`) aktuelle News, Trends und Anlässe für den Kunden. Grundlage sind CI, Briefing und die letzten Posts.
2. Claude schreibt daraus fertige Posts je Plattform, mit Hashtags, Headline für die Grafik und Quellen.

Das dauert 1–3 Minuten. Aus einem Vorschlag wird mit **Einplanen** ein Post mit CI-Grafik zum nächsten freien Termin. Der Termin folgt den Tagen und der Uhrzeit des Autopiloten. **Bearbeiten** legt einen Entwurf an und öffnet den Editor. Ohne verbundenen Kanal bleibt der Post ein Entwurf mit Termin.

Die CI-Grafik (`src/lib/server/social/graphic.tsx`) wird mit `next/og` gerechnet:

- Fläche in der Hauptfarbe, Akzent in der Zweitfarbe.
- Headline in der Hausschrift von Google Fonts, sonst Inter.
- Logo der Akte.

Formate: LinkedIn, Instagram und Facebook 4:5, TikTok 9:16.

API (auch für den Agenten):

- `GET /api/marketing/ideas?workspace=<id>`
- `POST /api/marketing/ideas` mit `{ workspace_id, providers, per_provider, focus? }`
- `PATCH /api/marketing/ideas/<id>` mit `{ status: "dismissed" | "new" }`
- `POST /api/marketing/ideas/<id>/post` mit `{ schedule: "next" | "none" | ISO, graphic?, mode? }`

## Autopilot (vollautomatisch)

Unter Einstellungen → Autopilot, je Akte:

- Plattformen, Posts pro Woche, Tage, Uhrzeit, Themen-Fokus.
- **Mit Freigabe:** Die Posts landen als Entwurf mit Termin im Kalender.
- **Vollautomatisch:** Die Posts werden eingeplant und zum Termin veröffentlicht. Dafür muss der Kanal verbunden sein.
- **To-dos aus Calls an den Agenten:** GRID-To-dos aus ausgewerteten Calls werden automatisch übernommen und an den Agenten gegeben.

Der Cron `/api/cron/marketing` läuft stündlich von 5 bis 20 Uhr UTC und braucht `CRON_SECRET` und `ANTHROPIC_API_KEY`. Je Aufruf erledigt er:

- höchstens eine fällige Akte im Autopiloten (einmal pro Woche),
- die Übernahme der Call-To-dos,
- die älteste Aufgabe, die beim Agenten wartet.

„Jetzt ausführen“ plant sofort eine Woche voraus.

## Agent bearbeitet Aufgaben

Ein To-do „An Agent übergeben“ startet den Agenten sofort (`POST /api/aufgaben/agent/<taskId>`, `DELETE` nimmt die Übergabe zurück). Er arbeitet mit Claude im Tool-Loop (`src/lib/server/agent/runner.ts`) und nutzt diese Werkzeuge:

- Websuche
- Post anlegen, mit CI-Grafik oder Video
- Vorschläge recherchieren und umsetzen
- Posts und Vorschläge lesen
- Creatomate-Vorlagen rendern
- Voiceover mit der Stimme aus der CI

Er hält sich an CI, Briefing, Notizen und Checkliste. Jeder Schritt landet im Protokoll an der Aufgabe, am Ende steht eine Zusammenfassung.

- Status: wartet → arbeitet → bitte prüfen / erledigt / Fehler.
- Im Modus „Mit Freigabe“ legt er Posts als Entwurf an und meldet „bitte prüfen“.
- Im Modus „Vollautomatisch“ plant er Posts ein und hakt erledigte To-dos ab.

Was er nicht selbst kann (z. B. Fotos vor Ort, Freigaben beim Kunden), nennt er als offene Punkte.

Noch nicht enthalten (nächste Stufe):

- Community-Management (Kommentare und DMs beantworten). Braucht zusätzliche Rechte in den Plattform-Apps.
- Rohvideos schneiden.
- Performance-Auswertung.

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
- Scopes: `r_organization_social`, `w_organization_social`, `rw_organization_admin`.
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
  - **LinkedIn:** Text oder Bilder. Videos folgen.
  - **TikTok:** Video oder Foto-Post.

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
```

Eigene Dateien: `POST /api/marketing/media` mit `{ url }` oder als Datei bis 4 MB. Größere Dateien über `POST /api/marketing/media/upload-url`, dann per PUT an die gelieferte Adresse.

Alle Endpunkte stehen auch in Marketing → Agent & API.
