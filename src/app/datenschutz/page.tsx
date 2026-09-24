import type { Metadata } from "next";
import { LegalShell } from "@/components/app/LegalShell";
import { ConsentSettings } from "@/components/app/ConsentSettings";

export const metadata: Metadata = {
  title: "Datenschutzerklärung | GRID Agency",
};

function H({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-2 scroll-mt-24 text-base font-medium text-snow">
      {children}
    </h2>
  );
}

export default function DatenschutzPage() {
  return (
    <LegalShell title="Datenschutz">
      <div className="space-y-8 text-sm font-light leading-relaxed text-snow/70">
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
          <H>1. Verantwortlicher</H>
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
          <H>2. Hosting und Server-Logfiles</H>
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
          <H>3. Cookies und lokale Speicherung</H>
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
              ob die Intro-Animation in diesem Besuch schon lief (wird beim
              Schließen des Tabs gelöscht),
            </li>
            <li>
              zu welchem Abschnitt der Startseite du aus dem Menü springen
              wolltest (wird sofort nach dem Sprung gelöscht),
            </li>
            <li>
              falls du es ausdrücklich wählst: deine Einwilligung für
              Calendly (siehe Abschnitt 6), bis du sie widerrufst.
            </li>
          </ul>
          <p className="mt-2">
            Diese Speicherung ist für die von dir gewünschte Funktion
            unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG) und erfordert
            keine Einwilligung.
          </p>
        </section>

        <section>
          <H id="kontaktformular">4. Kontaktformular, E-Mail und Telefon</H>
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
          <H>5. Bewerbungen</H>
          <p>
            Wenn du dich per E-Mail bei uns bewirbst, verarbeiten wir deine
            Bewerbungsunterlagen ausschließlich für das Bewerbungsverfahren
            (Art. 6 Abs. 1 lit. b DSGVO). Kommt keine Zusammenarbeit zustande,
            löschen wir deine Unterlagen spätestens sechs Monate nach Abschluss
            des Verfahrens, sofern du nicht einer längeren Speicherung für
            spätere Stellen zugestimmt hast.
          </p>
        </section>

        <section>
          <H id="calendly">6. Terminbuchung über Calendly</H>
          <p>
            Für die Buchung eines Erstgesprächs nutzen wir Calendly der
            Calendly LLC, 115 E Main St, Ste A1B, Buford, GA 30518, USA. Beim
            Aufruf unserer Seite wird keine Verbindung zu Calendly
            hergestellt. Erst wenn du auf einen Buchungs-Button klickst und
            im folgenden Hinweis &bdquo;Kalender laden&ldquo; wählst, wird der
            Kalender von Calendly eingebunden. Dabei überträgt dein Browser
            deine IP-Adresse und technische Daten an Calendly, Calendly kann
            Cookies setzen, und die Angaben, die du im Kalender machst (Name,
            E-Mail-Adresse, gewählter Termin, optionale Angaben), werden von
            Calendly verarbeitet.
          </p>
          <p className="mt-2">
            Rechtsgrundlage für das Laden ist deine Einwilligung (Art. 6 Abs.
            1 lit. a DSGVO, § 25 Abs. 1 TDDDG), für die Terminbuchung selbst
            die Anbahnung einer Zusammenarbeit (Art. 6 Abs. 1 lit. b DSGVO).
            Calendly ist unter dem EU-US Data Privacy Framework zertifiziert.
            Weitere Informationen findest du in der Datenschutzerklärung von
            Calendly unter calendly.com/privacy. Alternativ kannst du einen
            Termin per E-Mail oder Telefon vereinbaren.
          </p>
        </section>

        <section>
          <H id="einstellungen">7. Datenschutz-Einstellungen</H>
          <p>
            Hier siehst du, ob du eine Einwilligung gespeichert hast, und
            kannst sie jederzeit mit Wirkung für die Zukunft widerrufen
            (Art. 7 Abs. 3 DSGVO).
          </p>
          <ConsentSettings />
        </section>

        <section>
          <H>8. Links zu sozialen Netzwerken und Google</H>
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
          <H>9. Veranstaltungen</H>
          <p>
            Die Informationen zu unseren Events laden wir serverseitig aus
            unserer Datenbank. Dein Browser spricht dabei nur mit unserer
            eigenen Domain; es werden keine Daten von dir an Dritte
            übertragen.
          </p>
        </section>

        <section>
          <H>10. Deine Rechte</H>
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
          <H>11. Keine automatisierte Entscheidungsfindung</H>
          <p>
            Wir setzen keine automatisierte Entscheidungsfindung
            einschließlich Profiling im Sinne von Art. 22 DSGVO ein.
          </p>
        </section>

        <p className="text-xs text-snow/40">Stand: September 2026</p>
      </div>
    </LegalShell>
  );
}
