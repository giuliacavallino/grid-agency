# GRID Agency

Website für GRID Agency — Social Media Agentur in Berlin & Frankfurt.

Built with Next.js (App Router), Tailwind CSS, Framer Motion and Supabase.

## Stack

- **Next.js 16** — App Router, Server Actions
- **Tailwind CSS v4** — Design-System auf Basis der GRID Brand Guidelines (Sky, Snow, Dune, Earth, Dawn)
- **Readex Pro** — offizielle Markenschrift, lokal eingebunden (`src/app/fonts`)
- **Framer Motion** — Scroll- und Hero-Animationen
- **Supabase** — speichert Kontaktanfragen (`contact_submissions`)

## Getting Started

```bash
npm install
npm run dev
```

Kopiere `.env.example` nach `.env.local` und trage die Supabase-Projektdaten ein:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Projektstruktur

- `src/components` — UI-Sektionen (Hero, Services, Clients, Process, Contact, Footer …)
- `src/app/actions/contact.ts` — Server Action für das Kontaktformular
- `src/lib/supabase.ts` — Supabase-Client
- `public/brand` — Logo, Monogramm und Pattern in allen Markenfarben, extrahiert aus den offiziellen Brand Guidelines

## Deployment

Das Projekt ist für Vercel vorbereitet (Team `grid-agency`, Projekt `grid-agency`). Umgebungsvariablen müssen im Vercel-Projekt hinterlegt werden.
