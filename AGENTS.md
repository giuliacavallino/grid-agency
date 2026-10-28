<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI-Konventionen

- Buttons, die etwas auslösen, das dauert (Formular senden, Login, Laden, Weiterleiten), zeigen immer eine Ladeanzeige: Spinner im Button, Text auf den Zustand ändern (z. B. „Wird gesendet…“), `disabled` + `aria-busy` solange es läuft. Website: `LoaderCircle` aus lucide-react mit `animate-spin`. Intranet: `Button` aus `intranet/src/components/ui.tsx` mit `loading` und `loadingText`.
- Intranet: Hell- und Dunkelmodus folgen der Systemeinstellung. Keine festen Farbwerte für Flächen und Text, sondern die Tokens aus `intranet/src/app/globals.css` (`snow` = Vordergrund, `sky` = Hintergrund, `canvas`, `surface`, `panel`, `ink`). Akzentfarben als Text über `accentText()` aus `intranet/src/lib/theme.ts`.
- Das Intranet (`intranet/`) ist eine eigene Next.js-App mit eigenem `package.json`; Befehle dort ausführen.
