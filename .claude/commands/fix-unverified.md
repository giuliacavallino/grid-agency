---
description: Repariert Commits, die GitHub als "Unverified" anzeigen würde (falscher Committer), und pusht den Branch
allowed-tools: Bash(git *)
---

Repariere alle lokalen Commits auf dem aktuellen Branch, die GitHub als **Unverified** anzeigen würde, und pushe anschließend.

Gehe so vor:

1. Ermittle den aktuellen Branch mit `git branch --show-current`.
2. Finde die betroffenen Commits: alle Commits, die noch nicht auf `origin/<branch>` liegen (falls der Remote-Branch nicht existiert: alle Commits seit `origin/main`) und deren Committer-E-Mail **nicht** `noreply@anthropic.com` ist. Prüfe mit:
   `git log --format="%h %ce" origin/<branch>..HEAD` (bzw. `origin/main..HEAD`).
3. Wenn keine betroffenen Commits existieren: kurz melden, nichts tun.
4. Setze die Git-Identität für dieses Repo:
   `git config user.email noreply@anthropic.com && git config user.name Claude`
5. Repariere die Commits:
   - Nur der letzte Commit betroffen → `git commit --amend --no-edit --reset-author`
   - Auch frühere Commits betroffen → `git rebase --exec "git commit --amend --no-edit --reset-author" <basis>` wobei `<basis>` der letzte nicht betroffene Commit ist (i. d. R. `origin/<branch>` bzw. `origin/main`).
6. Pushe mit `git push -u origin <branch>`. Wenn der Remote-Branch die alten Commit-Hashes bereits enthält, nutze `git push --force-with-lease` (niemals blankes `--force`).
7. Bei Netzwerkfehlern: bis zu 4-mal mit exponentiellem Backoff (2s, 4s, 8s, 16s) wiederholen. Bei 403/Berechtigungsfehlern: nicht wiederholen, sondern melden, dass die GitHub-App Schreibrechte braucht.
8. Melde am Ende kompakt: reparierte Commits (alte → neue Hashes) und ob der Push erfolgreich war.
