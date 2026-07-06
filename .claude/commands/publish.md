---
description: Pusht den aktuellen Branch zu GitHub (mit Fallbacks bei 403) und eröffnet einen Draft-PR
argument-hint: [pr-titel (optional)]
---

Veröffentliche den aktuellen Branch auf GitHub und sorge dafür, dass ein Draft-PR existiert. Arbeite die Stufen strikt in dieser Reihenfolge ab und brich bei Erfolg früh ab.

## Stufe 0 — Vorbereitung

1. `git branch --show-current` → `<branch>`. Wenn `<branch>` = `main`: abbrechen und melden (nie direkt auf main veröffentlichen).
2. Prüfe auf Unverified-Commits (Committer-E-Mail ≠ `noreply@anthropic.com` auf ungepushten Commits). Falls vorhanden: repariere sie zuerst wie in `/fix-unverified` beschrieben (git config setzen, dann `--amend` bzw. `rebase --exec`).

## Stufe 1 — Normaler Push

`git push -u origin <branch>`

- Bei Netzwerkfehlern (Timeout, Connection reset): bis zu 4 Retries mit Backoff 2s/4s/8s/16s.
- Bei **403**: NICHT wiederholen → Stufe 2.

## Stufe 2 — Fallback über GitHub-API (MCP)

Versuche mit den `mcp__github__*`-Tools:

1. `create_branch` (from main), falls der Remote-Branch fehlt.
2. `push_files` für die geänderten Dateien (nur wenn ausschließlich Textdateien betroffen sind — bei Binärdateien wie PNG/TTF diesen Weg überspringen, da Inhalte sonst korrumpiert werden können).
- Bei **403 "Resource not accessible by integration"**: → Stufe 3.

## Stufe 3 — Berechtigungen fehlen (menschliche Aktion nötig)

Melde dem User kompakt und ohne weitere Versuche:

> Die GitHub-App hat keinen Schreibzugriff auf dieses Repository.
> Fix: https://github.com/settings/installations → Claude → Configure →
> Repository-Zugriff für dieses Repo prüfen und die Berechtigungen
> **Contents: Read & write** sowie **Pull requests: Read & write** erteilen.
> Alternativ in den Claude-Einstellungen die GitHub-Verbindung trennen und neu verbinden.

Liste dabei die lokal wartenden Commits auf (`git log origin/main..HEAD --oneline`), damit nichts verloren geht.

## Stufe 4 — Draft-PR (nur nach erfolgreichem Push)

1. Prüfe mit `list_pull_requests`, ob für `<branch>` bereits ein offener PR existiert. Wenn ja: URL melden, fertig.
2. Sonst `create_pull_request` mit `draft: true`, Base `main`, Titel = `$ARGUMENTS` falls angegeben, sonst aus dem letzten Commit ableiten. Body: kurze Zusammenfassung der Änderungen.
3. Melde die PR-URL.
