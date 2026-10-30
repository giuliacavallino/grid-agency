import { clients } from "@/lib/content";
import { ContactLink } from "@/components/ui/ContactLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjektCard } from "./ProjektCard";

/** Projektübersicht: jedes Projekt als Karte, verlinkt auf die Projektseite. */
export function ProjekteView() {
  return (
    <div>
      <PageHeader
        eyebrow="Projekte"
        title={
          <>
            Marken, die uns ihren <span className="text-aurora">Feed</span> anvertrauen.
          </>
        }
        text={`${clients.length} Brands aus Berlin, Frankfurt und darüber hinaus. Tipp auf ein Projekt für Case, Galerie und Einblicke.`}
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
        {clients.map((client, i) => (
          <div key={client.name} className="reveal" style={{ "--d": `${(i % 3) * 70}ms` } as React.CSSProperties}>
            <ProjektCard client={client} eager={i < 6} />
          </div>
        ))}
      </div>

      <p className="mt-14 text-center text-sm font-light text-snow/55">
        Deine Marke fehlt hier noch?{" "}
        <ContactLink tab="nachricht" className="font-medium text-snow underline-offset-4 hover:underline">
          Lass uns reden →
        </ContactLink>
      </p>
    </div>
  );
}
