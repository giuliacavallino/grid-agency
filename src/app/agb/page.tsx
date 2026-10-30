import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { LegalArticle, LegalHeading } from "@/components/app/LegalArticle";

export const metadata: Metadata = {
  title: "AGB | GRID Agency",
  description:
    "Allgemeine Geschäftsbedingungen der GRID Agency UG (haftungsbeschränkt) für Social-Media-, Content- und Event-Leistungen.",
};

export default function AgbPage() {
  return (
    <PageShell>
      <LegalArticle title="Allgemeine Geschäftsbedingungen">
        <section>
          <LegalHeading>§ 1 Geltungsbereich</LegalHeading>
          <p>
            Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge
            zwischen der GRID Agency UG (haftungsbeschränkt), Eichendorffstraße
            32, 60320 Frankfurt am Main („GRID“), und ihren Kunden über
            Leistungen in den Bereichen Social Media, Content-Produktion,
            Community Management, Werbeanzeigen und Events.
          </p>
          <p className="mt-2">
            Unsere Angebote richten sich ausschließlich an Unternehmer im
            Sinne von § 14 BGB, juristische Personen des öffentlichen Rechts
            und öffentlich-rechtliche Sondervermögen. Abweichende oder
            ergänzende Bedingungen des Kunden gelten nur, wenn GRID ihnen
            ausdrücklich in Textform zustimmt.
          </p>
        </section>

        <section>
          <LegalHeading>§ 2 Vertragsschluss</LegalHeading>
          <p>
            Angebote von GRID sind freibleibend und 30 Tage gültig, sofern
            nichts anderes angegeben ist. Ein Vertrag kommt zustande, wenn der
            Kunde ein Angebot in Textform (z. B. per E-Mail oder digitaler
            Unterschrift) annimmt oder GRID einen Auftrag bestätigt. Umfang,
            Laufzeit und Vergütung ergeben sich aus dem Angebot; bei
            Widersprüchen geht das Angebot diesen AGB vor.
          </p>
        </section>

        <section>
          <LegalHeading>§ 3 Leistungen</LegalHeading>
          <p>
            GRID erbringt die im Angebot beschriebenen Leistungen mit der
            Sorgfalt einer professionellen Agentur. Soweit nichts anderes
            vereinbart ist, schuldet GRID die vereinbarte Tätigkeit, nicht
            einen bestimmten wirtschaftlichen Erfolg. Reichweite,
            Followerzahlen, Interaktionen oder Umsätze hängen von Plattformen
            und Nutzern ab, auf die GRID keinen Einfluss hat, und werden nicht
            zugesichert.
          </p>
          <p className="mt-2">
            GRID darf zur Leistungserbringung sorgfältig ausgewählte
            Freelancer und Dienstleister einsetzen (z. B. Fotografen,
            Videografen, Models). GRID bleibt gegenüber dem Kunden
            verantwortlich. Zusätzliche Leistungen, die über das Angebot
            hinausgehen, werden nach Absprache gesondert vergütet.
          </p>
        </section>

        <section>
          <LegalHeading>§ 4 Mitwirkung des Kunden</LegalHeading>
          <p>
            Der Kunde stellt rechtzeitig alle Informationen, Zugänge zu
            Social-Media-Konten, Logos, Bilder, Texte und sonstigen
            Materialien bereit, die für die Leistung nötig sind, und benennt
            eine Ansprechperson. Verzögert sich die Leistung, weil
            Mitwirkungen fehlen, verschieben sich vereinbarte Termine
            entsprechend; dadurch entstehender Mehraufwand kann berechnet
            werden.
          </p>
          <p className="mt-2">
            Der Kunde versichert, dass er die Rechte an den von ihm
            gelieferten Materialien besitzt und deren Nutzung keine Rechte
            Dritter verletzt. Er stellt GRID von Ansprüchen Dritter frei, die
            aus einer solchen Rechtsverletzung entstehen.
          </p>
        </section>

        <section>
          <LegalHeading>§ 5 Freigaben und Korrekturen</LegalHeading>
          <p>
            Inhalte werden vor der Veröffentlichung zur Freigabe vorgelegt,
            sofern nichts anderes vereinbart ist. Der Kunde prüft sie zeitnah,
            spätestens innerhalb von fünf Werktagen. Äußert er sich in dieser
            Frist nicht, gilt der Inhalt als freigegeben; GRID weist bei der
            Vorlage darauf hin. Mit der Freigabe übernimmt der Kunde die
            Verantwortung für die inhaltliche Richtigkeit, insbesondere für
            Produkt-, Preis- und Gesundheitsangaben.
          </p>
          <p className="mt-2">
            Je Inhalt sind zwei Korrekturschleifen im Preis enthalten.
            Weitere Änderungen sowie Änderungen nach Freigabe werden nach
            Aufwand berechnet.
          </p>
        </section>

        <section>
          <LegalHeading>§ 6 Vergütung und Zahlung</LegalHeading>
          <p>
            Alle Preise verstehen sich netto zuzüglich der gesetzlichen
            Umsatzsteuer. Monatliche Pauschalen werden zu Beginn des
            jeweiligen Monats berechnet. Bei Projekten kann GRID eine
            Anzahlung von bis zu 50 % verlangen; der Rest wird nach
            Fertigstellung fällig. Rechnungen sind innerhalb von 14 Tagen ohne
            Abzug zu zahlen.
          </p>
          <p className="mt-2">
            Werbebudgets für bezahlte Anzeigen, Fremdkosten (z. B. Models,
            Locations, Requisiten, Lizenzen) sowie Reisekosten außerhalb von
            Berlin und Frankfurt am Main sind nicht in der Vergütung
            enthalten und werden nach vorheriger Absprache gesondert berechnet
            oder vom Kunden direkt getragen.
          </p>
          <p className="mt-2">
            Kommt der Kunde in Zahlungsverzug, gelten die gesetzlichen
            Regelungen. GRID kann die weitere Leistung zurückhalten, bis
            offene Rechnungen bezahlt sind.
          </p>
        </section>

        <section>
          <LegalHeading>§ 7 Laufzeit und Kündigung</LegalHeading>
          <p>
            Laufende Betreuungen haben die im Angebot genannte
            Mindestlaufzeit. Ist keine Laufzeit vereinbart, läuft der Vertrag
            auf unbestimmte Zeit und kann von beiden Seiten mit einer Frist
            von einem Monat zum Monatsende gekündigt werden. Ist eine
            Mindestlaufzeit vereinbart, verlängert sich der Vertrag danach auf
            unbestimmte Zeit mit derselben Kündigungsfrist.
          </p>
          <p className="mt-2">
            Das Recht zur außerordentlichen Kündigung aus wichtigem Grund
            bleibt unberührt. Kündigungen bedürfen der Textform.
          </p>
          <p className="mt-2">
            Sagt der Kunde einen vereinbarten Produktions- oder Eventtermin
            weniger als 48 Stunden vorher ab, trägt er die bis dahin
            entstandenen und nicht mehr stornierbaren Kosten.
          </p>
        </section>

        <section>
          <LegalHeading>§ 8 Nutzungsrechte</LegalHeading>
          <p>
            Mit vollständiger Bezahlung erhält der Kunde an den
            Arbeitsergebnissen ein einfaches, zeitlich und räumlich
            unbeschränktes Nutzungsrecht für die im Angebot genannten Zwecke
            und Kanäle. Ist nichts anderes vereinbart, umfasst das die
            Nutzung auf den eigenen Social-Media-Kanälen und der eigenen
            Website des Kunden. Weitergehende Nutzungen, etwa für Print,
            Außenwerbung oder TV, bedürfen einer gesonderten Vereinbarung.
          </p>
          <p className="mt-2">
            Rohdaten, offene Projektdateien und nicht verwendetes Material
            sind nicht geschuldet. Musik und Effekte aus den Bibliotheken der
            Plattformen dürfen nur innerhalb der jeweiligen Plattform genutzt
            werden. Für Personen auf Fotos und Videos gelten die mit ihnen
            vereinbarten Nutzungsrechte.
          </p>
        </section>

        <section>
          <LegalHeading>§ 9 Referenzen</LegalHeading>
          <p>
            GRID darf den Kunden mit Namen und Logo als Referenz nennen und
            veröffentlichte Arbeitsergebnisse in der Eigenwerbung zeigen,
            etwa auf der eigenen Website und den eigenen Social-Media-Kanälen.
            Der Kunde kann dem jederzeit in Textform widersprechen.
          </p>
        </section>

        <section>
          <LegalHeading>§ 10 Plattformen Dritter</LegalHeading>
          <p>
            Social-Media-Plattformen wie Instagram, TikTok, Facebook oder
            LinkedIn werden von Dritten betrieben. GRID haftet nicht für deren
            Ausfälle, Änderungen an Funktionen, Algorithmen oder
            Nutzungsbedingungen, Sperrungen von Konten oder die Ablehnung von
            Anzeigen, soweit GRID diese nicht zu vertreten hat.
          </p>
          <p className="mt-2">
            GRID achtet auf die üblichen Regeln für Social-Media-Inhalte,
            erbringt aber keine Rechtsberatung. Die rechtliche Prüfung von
            Gewinnspielen, Werbeaussagen und Kennzeichnungen obliegt dem
            Kunden, soweit nichts anderes vereinbart ist.
          </p>
        </section>

        <section>
          <LegalHeading>§ 11 Haftung</LegalHeading>
          <p>
            GRID haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit,
            bei Verletzung von Leben, Körper oder Gesundheit sowie nach dem
            Produkthaftungsgesetz. Bei leichter Fahrlässigkeit haftet GRID nur
            für die Verletzung wesentlicher Vertragspflichten, also solcher
            Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des
            Vertrags erst ermöglicht und auf deren Einhaltung der Kunde
            vertrauen darf. In diesem Fall ist die Haftung auf den
            vorhersehbaren, vertragstypischen Schaden begrenzt. Im Übrigen ist
            die Haftung ausgeschlossen.
          </p>
        </section>

        <section>
          <LegalHeading>§ 12 Vertraulichkeit und Datenschutz</LegalHeading>
          <p>
            Beide Seiten behandeln vertrauliche Informationen der anderen
            Seite, insbesondere Zugangsdaten, Geschäftszahlen und
            unveröffentlichte Inhalte, auch über das Vertragsende hinaus
            vertraulich. Verarbeitet GRID im Auftrag des Kunden
            personenbezogene Daten, etwa im Community Management, schließen
            die Parteien einen Vertrag zur Auftragsverarbeitung nach Art. 28
            DSGVO.
          </p>
        </section>

        <section>
          <LegalHeading>§ 13 Schlussbestimmungen</LegalHeading>
          <p>
            Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss
            des UN-Kaufrechts. Ist der Kunde Kaufmann, juristische Person des
            öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen,
            ist Gerichtsstand Frankfurt am Main. Änderungen und Ergänzungen
            des Vertrags bedürfen der Textform. Sollte eine Bestimmung dieser
            AGB unwirksam sein, bleibt die Wirksamkeit der übrigen
            Bestimmungen unberührt.
          </p>
        </section>

        <p className="text-xs text-snow/40">Stand: Oktober 2026</p>
      </LegalArticle>
    </PageShell>
  );
}
