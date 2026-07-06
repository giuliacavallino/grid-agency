import type { Metadata } from "next";
import { LegalShell } from "@/components/app/LegalShell";

export const metadata: Metadata = {
  title: "Datenschutzerklärung — GRID Agency",
};

export default function DatenschutzPage() {
  return (
    <LegalShell title="Datenschutz">
      <div className="space-y-8 text-sm font-light leading-relaxed text-snow/70">
          <section>
            <h2 className="mb-2 text-base font-medium text-snow">
              1. Verantwortlicher
            </h2>
            <p>
              Verantwortlich für die Datenverarbeitung auf dieser Website ist:
              <br />
              GRID Agency UG (haftungsbeschränkt)
              <br />
              Eichendorffstraße 32, 60320 Frankfurt am Main
              <br />
              E-Mail: hello@grid-agency.de
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-snow">
              2. Hosting
            </h2>
            <p>
              Diese Website wird bei Vercel Inc. gehostet. Beim Aufruf der
              Website verarbeitet Vercel automatisch technische Informationen
              (u. a. IP-Adresse, Zeitpunkt des Zugriffs, aufgerufene Seiten)
              in sogenannten Server-Logfiles, um die Website sicher und
              performant auszuliefern. Rechtsgrundlage ist unser berechtigtes
              Interesse an einer stabilen und sicheren Bereitstellung der
              Website (Art. 6 Abs. 1 lit. f DSGVO).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-snow">
              3. Kontaktformular
            </h2>
            <p>
              Wenn du uns über das Kontaktformular kontaktierst, werden die
              von dir angegebenen Daten (Name, E-Mail-Adresse, optional
              Unternehmen und Budget, sowie deine Nachricht) zur Bearbeitung
              deiner Anfrage bei unserem Datenbank-Dienstleister Supabase
              Inc. gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b
              DSGVO (Vertragsanbahnung) bzw. Art. 6 Abs. 1 lit. f DSGVO
              (berechtigtes Interesse an der Beantwortung deiner Anfrage).
              Wir löschen diese Daten, sobald sie für die Bearbeitung deiner
              Anfrage nicht mehr erforderlich sind.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-snow">
              4. Cookies &amp; Tracking
            </h2>
            <p>
              Diese Website verwendet aktuell keine Cookies für Marketing-
              oder Analysezwecke und keine Tracking- oder
              Analyse-Werkzeuge Dritter.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-snow">
              5. Deine Rechte
            </h2>
            <p>
              Du hast das Recht auf Auskunft, Berichtigung, Löschung,
              Einschränkung der Verarbeitung, Datenübertragbarkeit sowie
              Widerspruch gegen die Verarbeitung deiner personenbezogenen
              Daten. Wende dich hierfür an hello@grid-agency.de. Außerdem
              hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde
              zu beschweren.
            </p>
          </section>
      </div>
    </LegalShell>
  );
}
