import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Impressum — GRID Agency",
};

export default function ImpressumPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-40">
        <h1 className="text-4xl font-medium tracking-tight text-snow">
          Impressum
        </h1>

        <div className="mt-12 space-y-8 text-sm font-light leading-relaxed text-snow/70">
          <section>
            <h2 className="mb-2 text-base font-medium text-snow">
              Angaben gemäß § 5 TMG
            </h2>
            <p>
              GRID Agency UG (haftungsbeschränkt)
              <br />
              Eichendorffstraße 32
              <br />
              60320 Frankfurt am Main
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-snow">
              Vertreten durch
            </h2>
            <p>Geschäftsführerin: Giulia Cavallino</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-snow">Kontakt</h2>
            <p>
              E-Mail: hello@grid-agency.de
              <br />
              Telefon: +49 1512 2910161
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-snow">
              Registereintrag
            </h2>
            <p>
              Eintragung im Handelsregister.
              <br />
              Registergericht: Amtsgericht Frankfurt am Main
              <br />
              Registernummer: HRB 140538
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-snow">
              Umsatzsteuer-ID
            </h2>
            <p>
              Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:
              <br />
              DE350319219
              <br />
              Steuernummer: 37/317/50165
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-snow">
              Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
            </h2>
            <p>Giulia Cavallino, Anschrift wie oben</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-snow">
              EU-Streitschlichtung
            </h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur
              Online-Streitbeilegung (OS) bereit:{" "}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-snow"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
              . Unsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind
              nicht verpflichtet und nicht bereit, an
              Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
