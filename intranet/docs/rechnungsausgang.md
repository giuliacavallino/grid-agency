# Rechnungsausgang im Intranet

Stand 30.10.2026: Schritte 1 bis 4 sind umgesetzt (Archiv, Rechnung schreiben und senden, Storno/Korrektur/Gutschrift, Serien mit Cron). Entscheidungen: Stornos und Gutschriften bekommen eigene Nummern aus dem Rechnungskreis; Serien schreiben fest und versenden automatisch.

Ziel: easybill ablösen. Das Intranet schreibt Rechnungen, Serienrechnungen, Gutschriften, Korrekturen und Stornos selbst, verschickt sie und verfolgt die Zahlungen.

## Ausgangslage (Import vom 30.10.2026)

Die easybill-Historie liegt in Supabase: `billing_documents`, `billing_items`, `billing_payments`, PDFs im privaten Bucket `billing`.

| Belegart | Anzahl |
| --- | --- |
| Rechnungen | 221 (25 davon storniert) |
| Stornos | 25 |
| Angebote | 95 |
| Auftragsbestätigungen | 33 |
| Serienrechnungen | 28 (4 laufend, 1 pausiert) |
| Zahlungserinnerungen und Mahnungen | 106 |
| Gutschriften | 1 |
| Briefe | 22 |

Umsatz netto (ohne Stornos): 2024 341 T€, 2025 363 T€, 2026 bisher 94 T€. Alle Rechnungen mit 19 % USt, keine Sonderfälle (Reverse Charge u. Ä.).

Nummernkreis bisher: `JJ-NNN` mit durchlaufendem Zähler, ohne Neustart zum Jahreswechsel (letzte Rechnung `26-221`). Stornos tragen in easybill die Nummer der Originalrechnung.

## Belegarten

- **Rechnung**: einmalig, Positionen aus den Artikeln oder frei
- **Serienrechnung**: Vorlage mit Rhythmus (monatlich, quartalsweise, jährlich), Startdatum, optional Enddatum. Ein täglicher Cron erzeugt daraus die Rechnung, je Serie wahlweise als Entwurf zur Freigabe oder direkt festgeschrieben und versendet. Platzhalter im Text wie `{Monat}` oder `{Zeitraum}`. Ersetzt die Retainer im Auftragsbuch (eine Quelle statt zwei).
- **Storno**: vollständige Gegenbuchung einer Rechnung mit eigener neuer Nummer und Verweis auf das Original. Die Originalrechnung bekommt den Status „storniert“.
- **Rechnungskorrektur**: Storno plus neue Rechnung in einem Schritt (häufigster Fall). Das Original wird als Kopie in den Editor geladen.
- **Gutschrift**: Teilbetrag zurück (Preisnachlass, Leistung teilweise nicht erbracht), mit Verweis auf die Rechnung
- **Zahlungserinnerung / Mahnung**: aus überfälligen Rechnungen, mit Stufen und optionaler Gebühr
- Angebot → Auftragsbestätigung → Rechnung: Beleg mit einem Klick in den nächsten übernehmen. Das Angebot hängt am Lead in der Pipeline.

## Ablauf und GoBD

1. **Entwurf**: frei bearbeitbar, noch ohne Nummer
2. **Festschreiben**: Die Nummer kommt lückenlos aus einer Datenbankfunktion (Zähler mit Zeilensperre). Das PDF wird erzeugt und abgelegt. Ab hier sperrt ein Trigger alle Inhaltsfelder; Löschen ist nicht mehr möglich.
3. **Versenden**: per Mail von buchhaltung@ über Microsoft Graph (wie heute der DATEV-Versand), PDF im Anhang. Versandzeitpunkt und Empfänger werden gespeichert.
4. **Zahlung**: Zahlungen erfassen (auch Teilzahlungen); daraus folgt der Status offen, teilbezahlt oder bezahlt. Überfällige Rechnungen erscheinen gesondert.
5. Korrigiert wird nur über Storno, Korrektur oder Gutschrift, nie durch Ändern des festgeschriebenen Belegs.

## Pflichtangaben und E-Rechnung

- Firmendaten in Finance → Einstellungen: Anschrift, Steuernummer, USt-IdNr., Bankverbindung, Logo, Fußzeile, Zahlungsziel (Standard)
- Leistungsdatum oder -zeitraum ist Pflicht und wird beim Festschreiben geprüft
- **E-Rechnung**: ab 2028 Pflicht für GRID (Umsatz unter 800 T€). Vorschlag: XRechnung (CII-XML) von Anfang an als zweiter Anhang zum PDF. ZUGFeRD (XML im PDF) lässt sich später ergänzen.
- PDF-Erzeugung serverseitig mit `@react-pdf/renderer`, Layout im GRID-Design

## Oberfläche (Finance → Ausgangsrechnungen)

- **Liste**: Filter nach Art, Status, Kunde, Jahr; Kennzahlen für offen, überfällig und Umsatz im Jahr; Suche nach Nummer und Kunde
- **Beleg**: PDF-Vorschau, Positionen, Zahlungen, verknüpfte Belege (Original, Storno, Mahnungen); Aktionen Festschreiben & senden, Stornieren, Korrigieren, Gutschrift, Zahlung erfassen, Duplizieren
- **Editor**: Kunde (Adresse und Zahlungsziel kommen aus dem Kunden), Positionen aus Artikeln mit Menge, Preis, USt und Rabatt, Leistungszeitraum, Einleitung, Schlusstext, Live-Summe
- **Serien**: Übersicht mit nächstem Termin, Pausieren, Beenden
- Kunde und Auftragsbuch zeigen die Belege und den Umsatz je Kunde

## Umsetzung in Schritten

1. **Archiv**: Historie in Finance anzeigen (Liste, Beleg, PDF). Liest nur.
2. **Rechnung schreiben**: Editor, Festschreiben mit Nummernkreis und Sperr-Trigger, PDF, Versand per Mail, Firmendaten
3. **Storno, Korrektur, Gutschrift**
4. **Serienrechnungen** mit Cron; Retainer gehen in den Serien auf
5. **Angebote mit Unterschrift**: Mappe aus Angebot, Agenturvertrag und SEPA-Mandat, Unterschrift auf sign.grid-agency.de, gesiegeltes PDF in der Kundenakte (siehe README)
6. **Zahlungen und Mahnwesen**, später Kontoabgleich über die Bank-API
7. **E-Rechnung (XRechnung)** und Ausgangsbelege an DATEV (Upload-Mail wie bei den Eingangsrechnungen)
8. **Umstieg**: einen Monat parallel zu easybill, danach easybill-Abgleich abschalten und kündigen. easybill-Daten bleiben als Archiv (Aufbewahrung 10 Jahre).
