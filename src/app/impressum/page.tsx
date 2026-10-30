import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { LegalArticle, LegalHeading } from "@/components/app/LegalArticle";

export const metadata: Metadata = {
  title: "Impressum | GRID Agency",
};

export default function ImpressumPage() {
  return (
    <PageShell>
      <LegalArticle title="Impressum">
        <section>
          <LegalHeading>Angaben gemäß § 5 DDG</LegalHeading>
          <p>
            GRID Agency UG (haftungsbeschränkt)
            <br />
            Eichendorffstraße 32
            <br />
            60320 Frankfurt am Main
          </p>
        </section>

        <section>
          <LegalHeading>Vertreten durch</LegalHeading>
          <p>Geschäftsführerin: Giulia Cavallino</p>
        </section>

        <section>
          <LegalHeading>Kontakt</LegalHeading>
          <p>
            E-Mail: hello@grid-agency.de
            <br />
            Telefon: +49 1512 2910161
          </p>
        </section>

        <section>
          <LegalHeading>Registereintrag</LegalHeading>
          <p>
            Eintragung im Handelsregister.
            <br />
            Registergericht: Amtsgericht Frankfurt am Main
            <br />
            Registernummer: HRB 235987 B
          </p>
        </section>

        <section>
          <LegalHeading>Umsatzsteuer-ID</LegalHeading>
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:
            <br />
            DE350319219
            <br />
            Steuernummer: 37/317/50165
          </p>
        </section>

        <section>
          <LegalHeading>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</LegalHeading>
          <p>Giulia Cavallino, Anschrift wie oben</p>
        </section>

        <section>
          <LegalHeading>Verbraucherstreitbeilegung</LegalHeading>
          <p>
            Wir sind nicht verpflichtet und nicht bereit, an
            Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>
      </LegalArticle>
    </PageShell>
  );
}
