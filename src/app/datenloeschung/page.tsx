import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/app/PageShell";
import { LegalArticle, LegalHeading } from "@/components/app/LegalArticle";

export const metadata: Metadata = {
  title: "Datenlöschung | GRID Agency",
};

export default function DatenloeschungPage() {
  return (
    <PageShell>
      <LegalArticle title="Datenlöschung">
        <section>
          <p>
            Diese Seite erklärt, wie du Daten löschen lässt, die GRID Agency
            über die App „GRID Intranet“ von Facebook oder Instagram erhalten
            hat. Die App nutzen wir, um Beiträge für Facebook-Seiten und
            Instagram-Business-Konten unserer Kunden zu planen und zu
            veröffentlichen.
          </p>
        </section>

        <section>
          <LegalHeading>1. Welche Daten wir speichern</LegalHeading>
          <p>
            Wenn du die App mit deinem Facebook-Konto verbindest, speichern
            wir nur, was wir für die Veröffentlichung brauchen: ID, Name und
            Profilbild der freigegebenen Facebook-Seiten und der damit
            verknüpften Instagram-Konten sowie die zugehörigen Zugangstokens.
            Die Tokens liegen verschlüsselt in unserer Datenbank. Dein
            Passwort erhalten wir nie.
          </p>
        </section>

        <section>
          <LegalHeading>2. Zugriff selbst entziehen</LegalHeading>
          <p>
            Öffne auf Facebook Einstellungen und Privatsphäre, dann
            Einstellungen, dann Business-Integrationen. Wähle „GRID Intranet“
            aus und klicke auf Entfernen. Ab dann kann die App nicht mehr auf
            deine Seiten und Instagram-Konten zugreifen. Gespeicherte Tokens
            werden damit ungültig.
          </p>
        </section>

        <section>
          <LegalHeading>3. Löschung beantragen</LegalHeading>
          <p>
            Schreib eine E-Mail an hello@grid-agency.de mit dem Betreff
            „Datenlöschung Meta“ und nenne die betroffene Facebook-Seite oder
            das Instagram-Konto. Wir löschen alle dazu gespeicherten Daten
            innerhalb von 30 Tagen und bestätigen dir die Löschung per E-Mail.
          </p>
          <p className="mt-2">
            Weitere Informationen findest du in unserer{" "}
            <Link href="/datenschutz" className="underline underline-offset-2 hover:text-snow/70">
              Datenschutzerklärung
            </Link>
            .
          </p>
        </section>

        <section lang="en">
          <LegalHeading>Data deletion (English)</LegalHeading>
          <p>
            GRID Agency uses the app “GRID Intranet” to schedule and publish
            posts for client Facebook Pages and Instagram business accounts.
            We store the ID, name and profile picture of the Pages and
            Instagram accounts you authorize, plus their access tokens, which
            are encrypted at rest.
          </p>
          <p className="mt-2">
            To revoke access, go to Facebook Settings and Privacy, Settings,
            Business Integrations, select “GRID Intranet” and click Remove. To
            have all stored data deleted, email hello@grid-agency.de with the
            subject “Data deletion Meta” and name the Page or Instagram
            account. We delete the data within 30 days and confirm by email.
          </p>
        </section>
      </LegalArticle>
    </PageShell>
  );
}
