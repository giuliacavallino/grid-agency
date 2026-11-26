/** Strukturierte Daten (schema.org) als JSON-LD. `<` wird maskiert,
 * damit Inhalte das Script-Tag nicht schließen können. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
