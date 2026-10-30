import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { LegalArticle, LegalHeading } from "@/components/app/LegalArticle";

export const metadata: Metadata = {
  title: "Datenschutzerklärung | GRID Agency",
};

export default function DatenschutzPage() {
  return (
    <PageShell>
      <LegalArticle title="Datenschutzerklärung">
        <section>
          <p>
            Der Schutz deiner Daten ist uns wichtig. Diese Website ist so
            gebaut, dass beim bloßen Besuch keine Tracking- oder
            Marketing-Werkzeuge laufen, keine Cookies gesetzt werden und keine
            Verbindungen zu Drittanbietern entstehen. Externe Dienste werden
            nur geladen, wenn du das ausdrücklich möchtest. Im Folgenden
            erklären wir, welche Daten wann verarbeitet werden.
          </p>
        </section>

        <section>
          <LegalHeading>1. Verantwortlicher</LegalHeading>
          <p>
            GRID Agency UG (haftungsbeschränkt)
            <br />
            Eichendorffstraße 32, 60320 Frankfurt am Main
            <br />
            Vertreten durch die Geschäftsführerin Giulia Cavallino
            <br />
            E-Mail: hello@grid-agency.de
            <br />
            Telefon: +49 1512 2910161
          </p>
        </section>

        <section>
          <LegalHeading>2. Hosting und Server-Logfiles</LegalHeading>
          <p>
            Diese Website wird bei Vercel Inc., 440 N Barranca Ave #4133,
            Covina, CA 91723, USA gehostet. Beim Aufruf der Website verarbeitet
            Vercel automatisch technische Informationen, die dein Browser
            übermittelt: IP-Adresse, Datum und Uhrzeit des Zugriffs,
            aufgerufene Seite, Referrer, Browsertyp und Betriebssystem. Diese
            Daten sind nötig, um die Website auszuliefern und vor Angriffen zu
            schützen. Sie werden nicht mit anderen Daten zusammengeführt und
            nach kurzer Zeit automatisch gelöscht.
          </p>
          <p className="mt-2">
            Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren
            und stabilen Bereitstellung der Website (Art. 6 Abs. 1 lit. f
            DSGVO). Mit Vercel besteht ein Vertrag zur Auftragsverarbeitung.
            Vercel ist unter dem EU-US Data Privacy Framework zertifiziert;
            zusätzlich gelten die EU-Standardvertragsklauseln.
          </p>
          <p className="mt-2">
            Die Verbindung zu dieser Website ist per TLS verschlüsselt (https).
            Schriftarten, Bilder und Videos liegen auf unserem eigenen Server;
            es wird keine Verbindung zu Google Fonts oder anderen
            Content-Delivery-Netzwerken aufgebaut.
          </p>
        </section>

        <section>
          <LegalHeading>3. Cookies und lokale Speicherung</LegalHeading>
          <p>
            Wir setzen keine Cookies und verwenden keine Analyse-, Tracking-
            oder Werbewerkzeuge. Deshalb brauchen wir auch kein
            Cookie-Banner.
          </p>
          <p className="mt-2">
            Für den Betrieb der Seite speichern wir wenige technische
            Einträge im Speicher deines Browsers (Session- bzw.
            Local-Storage), die unseren Server nie erreichen:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              zu welchem Abschnitt der Startseite du aus dem Menü springen
              wolltest (wird sofort nach dem Sprung gelöscht),
            </li>
            <li>
              ob du im Kontaktbereich &bdquo;Termin buchen&ldquo; oder
              &bdquo;Nachricht&ldquo; gewählt hast, wenn du von einer
              Unterseite kommst (wird sofort danach gelöscht).
            </li>
          </ul>
          <p className="mt-2">
            Diese Speicherung ist für die von dir gewünschte Funktion
            unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG) und erfordert
            keine Einwilligung.
          </p>
        </section>

        <section>
          <LegalHeading id="kontaktformular">4. Kontaktformular, E-Mail und Telefon</LegalHeading>
          <p>
            Wenn du uns über das Kontaktformular schreibst, verarbeiten wir
            die Angaben, die du machst (Name, E-Mail-Adresse, optional
            Unternehmen und Budget sowie deine Nachricht), um deine Anfrage zu
            beantworten. Die Daten werden über unseren Server an unseren
            Datenbank-Dienstleister Supabase Inc. übermittelt und dort gespeichert. Mit Supabase besteht
            ein Vertrag zur Auftragsverarbeitung; für Übermittlungen in
            Drittländer gelten die EU-Standardvertragsklauseln.
          </p>
          <p className="mt-2">
            Schreibst du uns per E-Mail oder rufst an, verarbeiten wir deine
            Kontaktdaten und den Inhalt deiner Nachricht ebenfalls nur zur
            Bearbeitung deines Anliegens.
          </p>
          <p className="mt-2">
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, wenn deine Anfrage
            auf eine Zusammenarbeit zielt, im Übrigen unser berechtigtes
            Interesse an der Beantwortung von Anfragen (Art. 6 Abs. 1 lit. f
            DSGVO). Wir löschen die Daten, sobald deine Anfrage erledigt ist
            und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
          </p>
        </section>

        <section>
          <LegalHeading id="bewerbungen">5. Bewerbungen</LegalHeading>
          <p>
            Wenn du dich über das Bewerbungsformular auf unserer Jobseite
            bewirbst, verarbeiten wir die Angaben, die du machst (Name,
            E-Mail-Adresse, Stelle, optional Telefonnummer, Link und
            Nachricht), sowie die hochgeladenen Unterlagen. Sie werden über
            unseren Server an unseren Datenbank-Dienstleister Supabase Inc.
            übermittelt und dort gespeichert (siehe Abschnitt 4) und sind nur
            für die Personen bei GRID zugänglich, die das Bewerbungsverfahren
            betreuen.
          </p>
          <p className="mt-2">
            Wenn du dich per E-Mail bei uns bewirbst, verarbeiten wir deine
            Unterlagen ebenso. Wir verarbeiten deine Bewerbung
            ausschließlich für das Bewerbungsverfahren
            (Art. 6 Abs. 1 lit. b DSGVO). Kommt keine Zusammenarbeit zustande,
            löschen wir deine Unterlagen spätestens sechs Monate nach Abschluss
            des Verfahrens, sofern du nicht einer längeren Speicherung für
            spätere Stellen zugestimmt hast.
          </p>
        </section>

        <section>
          <LegalHeading id="termine">6. Terminbuchung</LegalHeading>
          <p>
            Ein Erstgespräch kannst du direkt auf unserer Website buchen. Wir
            nutzen dafür keinen externen Buchungsdienst: Beim Öffnen des
            Kalenders fragt unser Server bei unserem internen System ab, zu
            welchen Zeiten wir frei sind. Dabei werden keine Daten von dir
            übertragen.
          </p>
          <p className="mt-2">
            Wenn du einen Termin buchst, verarbeiten wir die Angaben, die du
            machst (Name, E-Mail-Adresse, gewählter Termin, optional
            Unternehmen, Telefonnummer und Nachricht). Wir legen den Termin in
            unserem Kalender bei Microsoft 365 (Microsoft Ireland Operations
            Ltd., One Microsoft Place, South County Business Park,
            Leopardstown, Dublin 18, Irland) an und schicken dir von dort die
            Einladung mit einem Link zu Microsoft Teams. Deine Anfrage
            speichern wir außerdem bei unserem Datenbank-Dienstleister
            Supabase (siehe Abschnitt 4), um das Gespräch vorzubereiten. Mit
            Microsoft und Supabase bestehen Verträge zur
            Auftragsverarbeitung; für Übermittlungen in Drittländer gelten die
            EU-Standardvertragsklauseln bzw. das EU-US Data Privacy Framework.
          </p>
          <p className="mt-2">
            Rechtsgrundlage ist die Anbahnung einer Zusammenarbeit (Art. 6
            Abs. 1 lit. b DSGVO). Für das Gespräch in Microsoft Teams gelten
            zusätzlich die Datenschutzbestimmungen von Microsoft. Wir löschen
            deine Angaben, sobald sie für die Anbahnung nicht mehr nötig sind
            und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
          </p>
        </section>

        <section>
          <LegalHeading id="einstellungen">7. Keine Einwilligungen nötig</LegalHeading>
          <p>
            Auf unserer Website laden wir keine Inhalte, Skripte oder
            Schriften von Drittanbietern und setzen keine Cookies. Es gibt
            deshalb keine Einwilligungen, die du verwalten oder widerrufen
            müsstest.
          </p>
        </section>

        <section>
          <LegalHeading>8. Links zu sozialen Netzwerken und Google</LegalHeading>
          <p>
            Auf unserer Website verlinken wir auf Instagram-Profile und auf
            unsere Google-Bewertungen. Das sind einfache Links: Es werden
            keine Inhalte, Skripte oder Buttons dieser Anbieter auf unserer
            Seite eingebunden, und es werden keine Daten an sie übertragen,
            solange du den Link nicht anklickst. Nach dem Klick gelten die
            Datenschutzbestimmungen des jeweiligen Anbieters.
          </p>
        </section>

        <section>
          <LegalHeading>9. Veranstaltungen</LegalHeading>
          <p>
            Die Informationen zu unseren Events laden wir serverseitig aus
            unserer Datenbank. Dein Browser spricht dabei nur mit unserer
            eigenen Domain; es werden keine Daten von dir an Dritte
            übertragen.
          </p>
        </section>

        <section>
          <LegalHeading>10. Deine Rechte</LegalHeading>
          <p>Du hast jederzeit das Recht auf</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Auskunft über deine bei uns gespeicherten Daten (Art. 15 DSGVO),</li>
            <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO),</li>
            <li>Löschung (Art. 17 DSGVO),</li>
            <li>Einschränkung der Verarbeitung (Art. 18 DSGVO),</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO),</li>
            <li>
              Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft
              (Art. 7 Abs. 3 DSGVO).
            </li>
          </ul>
          <p className="mt-3 font-medium text-snow/85">Widerspruchsrecht</p>
          <p className="mt-1">
            Soweit wir Daten auf Grundlage berechtigter Interessen (Art. 6
            Abs. 1 lit. f DSGVO) verarbeiten, kannst du dieser Verarbeitung aus
            Gründen, die sich aus deiner besonderen Situation ergeben,
            jederzeit widersprechen (Art. 21 DSGVO).
          </p>
          <p className="mt-3">
            Schreib uns dafür einfach an hello@grid-agency.de. Außerdem hast
            du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu
            beschweren (Art. 77 DSGVO), zum Beispiel bei der für uns
            zuständigen Behörde: Der Hessische Beauftragte für Datenschutz und
            Informationsfreiheit, Gustav-Stresemann-Ring 1, 65189 Wiesbaden.
          </p>
        </section>

        <section>
          <LegalHeading>11. Keine automatisierte Entscheidungsfindung</LegalHeading>
          <p>
            Wir setzen keine automatisierte Entscheidungsfindung
            einschließlich Profiling im Sinne von Art. 22 DSGVO ein.
          </p>
        </section>

        <p className="text-xs text-snow/40">Stand: Oktober 2026</p>
      </LegalArticle>
    </PageShell>
  );
}
