import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { fillContract, formatIban, SEPA_TEXT, type ContractSnapshot, type SignField } from "@/lib/contract";
import type { BillingDetail, BillingSettings } from "@/lib/billing";
import { DAWN, DUNE, EARTH, InvoicePage, PALE, SKY } from "./invoice-pdf";
import { LOGO_PNG, MONOGRAM_PNG } from "./pdf-logo";

// Unterschriftsmappe: Angebot, Agenturvertrag, SEPA-Lastschriftmandat und –
// nach der Unterschrift – das Abschlussprotokoll, in einem PDF.

export type AuditEvent = { at: string; event: string; by?: string; ip?: string; ua?: string; detail?: string; field?: string; ref?: string };

export type SepaData = { holder: string; iban: string; bic?: string; bank?: string; street?: string; zip?: string; city?: string };

export type BundleInput = {
  id: string;
  /** Prüf-IDs: GRID und je Unterschriftsfeld des Kunden */
  grid_id: string;
  field_ids: Partial<Record<SignField, string>>;
  offer: BillingDetail;
  settings: BillingSettings;
  contract: ContractSnapshot;
  signer_name: string;
  signer_email: string;
  sepa_required: boolean;
  mandate_reference: string | null;
  grid_signer: string;
  grid_signature: string;
  grid_signed_at: string;
  customer_signature?: string | null;
  customer_signed_at?: string | null;
  sepa?: SepaData | null;
  audit?: AuditEvent[];
  unsigned_hash?: string | null;
  seal_fingerprint?: string | null;
  /** Abschlussprotokoll anhängen (nur nach der Unterschrift) */
  final?: boolean;
};

const L = 56;
const R = 48;

const s = StyleSheet.create({
  page: { fontFamily: "Readex", fontWeight: 300, fontSize: 8.6, color: SKY, paddingTop: 70, paddingLeft: L, paddingRight: R, paddingBottom: 64 },
  head: { position: "absolute", top: 26, left: L, right: R, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottomWidth: 0.6, borderBottomColor: DAWN },
  headText: { fontSize: 7.5, color: EARTH },
  foot: { position: "absolute", left: L, right: R, bottom: 24, flexDirection: "row", alignItems: "center", fontSize: 6.4, color: EARTH },
  eyebrow: { fontSize: 6.6, letterSpacing: 2.2, textTransform: "uppercase", color: EARTH },
  title: { fontSize: 24, fontWeight: 500, letterSpacing: -0.6, marginTop: 4 },
  dot: { color: DUNE },
  parties: { marginTop: 12, marginBottom: 16, padding: 12, backgroundColor: PALE, borderRadius: 10, lineHeight: "12.5pt" },
  heading: { fontSize: 9.5, fontWeight: 500, marginTop: 12, marginBottom: 4 },
  para: { lineHeight: "12pt", marginBottom: 4, textAlign: "justify" },
  signRow: { flexDirection: "row", marginTop: 26 },
  signCol: { flex: 1 },
  signBox: { height: 54, borderBottomWidth: 0.8, borderBottomColor: SKY, justifyContent: "flex-end", paddingBottom: 3 },
  signImage: { height: 46, objectFit: "contain", objectPositionX: 0 },
  signPending: { fontSize: 7.5, color: DUNE },
  stamp: { height: 62, justifyContent: "space-between", paddingLeft: 9, paddingVertical: 1 },
  bracket: { position: "absolute", left: 0, top: 4, bottom: 4, width: 16, borderLeftWidth: 1, borderTopWidth: 1, borderBottomWidth: 1, borderColor: SKY, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
  stampLabel: { fontSize: 5.8, letterSpacing: 0.4, color: EARTH, marginLeft: 12, marginTop: 0.5 },
  stampImage: { height: 38, objectFit: "contain", objectPositionX: 0 },
  stampId: { fontFamily: "Courier", fontSize: 6.4, color: SKY, marginLeft: 12, marginBottom: 0.5 },
  signLabel: { fontSize: 7.2, color: EARTH, marginTop: 4, lineHeight: "10pt" },
  box: { borderWidth: 0.6, borderColor: DAWN, borderRadius: 10, padding: 12, marginBottom: 12 },
  row: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: DAWN },
  label: { width: 140, fontSize: 6.8, letterSpacing: 1.2, textTransform: "uppercase", color: EARTH, paddingTop: 1.5 },
  value: { flex: 1, fontWeight: 400 },
  blank: { flex: 1, borderBottomWidth: 0.6, borderBottomColor: DUNE, height: 11 },
  mono: { fontSize: 7, color: EARTH },
  event: { flexDirection: "row", paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: DAWN, fontSize: 7.4 },
});

const dateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
const date = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "");

function customerAddress(offer: BillingDetail) {
  const a = offer.address ?? {};
  return {
    name: a.company_name || offer.customer_name || "",
    lines: [[a.first_name, a.last_name].filter(Boolean).join(" "), a.street, [a.zip_code, a.city].filter(Boolean).join(" ")].filter((l): l is string => !!l?.trim()),
  };
}

function Chrome({ title, input }: { title: string; input: BundleInput }) {
  const c = input.settings.company;
  return (
    <>
      <View style={s.head} fixed>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
        <Image src={LOGO_PNG} style={{ width: 44, height: 16 }} />
        <Text style={s.headText} render={({ pageNumber, totalPages }) => `${title} · ${customerAddress(input.offer).name} · Seite ${pageNumber} von ${totalPages}`} />
      </View>
      <View style={s.foot} fixed>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
        <Image src={MONOGRAM_PNG} style={{ width: 16, height: 9, marginRight: 10 }} />
        <Text style={{ flex: 1 }}>
          {c.name} · {c.street} · {c.zip} {c.city} · {c.register} · Mappe {input.id.slice(0, 8).toUpperCase()}
        </Text>
      </View>
    </>
  );
}

/** Elektronische Unterschrift: Klammer, Bild, Prüf-ID; offen nur eine Linie */
function Stamp({ image, id }: { image?: string | null; id?: string }) {
  if (!image || !id) {
    return (
      <View style={s.signBox}>
        <Text style={s.signPending}>wird elektronisch unterschrieben</Text>
      </View>
    );
  }
  return (
    <View style={s.stamp}>
      <View style={s.bracket} />
      <Text style={s.stampLabel}>Elektronisch unterschrieben · GRID sign</Text>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
      <Image src={image} style={s.stampImage} />
      <Text style={s.stampId}>{id}</Text>
    </View>
  );
}

function Signatures({ input, place }: { input: BundleInput; place: string }) {
  return (
    <View style={s.signRow} wrap={false}>
      <View style={[s.signCol, { marginRight: 24 }]}>
        <Stamp image={input.grid_signature} id={input.grid_id} />
        <Text style={s.signLabel}>
          Agentur: {input.settings.company.name}
          {"\n"}
          {input.grid_signer} · {place}, {date(input.grid_signed_at)}
        </Text>
      </View>
      <View style={s.signCol}>
        <Stamp image={input.customer_signature} id={input.field_ids.vertrag} />
        <Text style={s.signLabel}>
          Kunde: {customerAddress(input.offer).name}
          {"\n"}
          {input.signer_name}
          {input.customer_signed_at ? ` · elektronisch, ${date(input.customer_signed_at)}` : ""}
        </Text>
      </View>
    </View>
  );
}

/** Annahme unter dem Angebot */
function Acceptance({ input }: { input: BundleInput }) {
  return (
    <View style={{ marginTop: 18 }} wrap={false}>
      <Text style={[s.eyebrow, { marginBottom: 4 }]}>Annahme</Text>
      <Text style={s.para}>
        Hiermit nehme ich das Angebot {input.offer.number ?? ""} an. Es gilt der {input.contract.title}
        {input.sepa_required ? "; gezahlt wird per SEPA-Lastschrift" : ""}.
      </Text>
      <View style={[s.signRow, { marginTop: 8 }]}>
        <View style={[s.signCol, { marginRight: 24 }]} />
        <View style={s.signCol}>
          <Stamp image={input.customer_signature} id={input.field_ids.angebot} />
          <Text style={s.signLabel}>
            {customerAddress(input.offer).name} · {input.signer_name}
            {input.customer_signed_at ? ` · ${date(input.customer_signed_at)}` : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ContractPages({ input }: { input: BundleInput }) {
  const c = input.settings.company;
  const to = customerAddress(input.offer);
  const fill = (text: string) => fillContract(text, { terms: input.contract.terms, offerNumber: input.offer.number, offerDate: input.offer.document_date });
  return (
    <Page size="A4" style={s.page}>
      <Chrome title={input.contract.title} input={input} />
      <Text style={s.eyebrow}>Vertrag</Text>
      <Text style={s.title}>
        {input.contract.title}
        <Text style={s.dot}>.</Text>
      </Text>
      <View style={s.parties}>
        <Text>
          zwischen <Text style={{ fontWeight: 500 }}>{c.name}</Text>, {c.street}, {c.zip} {c.city}, vertreten durch die Geschäftsführung ({c.managing_director.replace(/^(Frau|Herr)\s+/, "")})
        </Text>
        <Text style={{ color: EARTH }}>– nachfolgend „Agentur“ –</Text>
        <Text style={{ marginTop: 4 }}>
          und <Text style={{ fontWeight: 500 }}>{to.name}</Text>
          {to.lines.length ? `, ${to.lines.join(", ")}` : ""}
        </Text>
        <Text style={{ color: EARTH }}>– nachfolgend „Kunde“ –</Text>
      </View>
      {input.contract.sections.map((section) => {
        const [first, ...rest] = fill(section.body)
          .split("\n")
          .filter((p) => p.trim());
        return (
          <View key={section.heading}>
            {/* Überschrift nie allein am Seitenende */}
            <View wrap={false}>
              <Text style={s.heading}>{section.heading}</Text>
              {first && <Text style={s.para}>{first}</Text>}
            </View>
            {rest.map((p, i) => (
              <Text key={i} style={s.para}>
                {p}
              </Text>
            ))}
          </View>
        );
      })}
      <Signatures input={input} place={c.city} />
    </Page>
  );
}

function SepaPage({ input }: { input: BundleInput }) {
  const c = input.settings.company;
  const sepa = input.sepa;
  const to = customerAddress(input.offer);
  const debtor: [string, string | undefined][] = [
    ["Kontoinhaber", sepa?.holder],
    ["Straße", sepa?.street ?? (sepa ? to.lines.find((l) => /\d/.test(l) && !/^\d{5}/.test(l)) : undefined)],
    ["PLZ und Ort", sepa ? [sepa.zip, sepa.city].filter(Boolean).join(" ") || to.lines.find((l) => /^\d{5}/.test(l)) : undefined],
    ["IBAN", sepa?.iban ? formatIban(sepa.iban) : undefined],
    ["BIC", sepa?.bic],
    ["Kreditinstitut", sepa?.bank],
  ];
  return (
    <Page size="A4" style={s.page}>
      <Chrome title="SEPA-Lastschriftmandat" input={input} />
      <Text style={s.eyebrow}>Zahlung</Text>
      <Text style={s.title}>
        SEPA-Lastschriftmandat
        <Text style={s.dot}>.</Text>
      </Text>
      <Text style={{ color: EARTH, marginTop: 4, marginBottom: 14 }}>für SEPA-Basislastschriften · wiederkehrende Zahlungen</Text>

      <View style={s.box}>
        <Text style={[s.eyebrow, { marginBottom: 6 }]}>Zahlungsempfänger</Text>
        {(
          [
            ["Name", c.name],
            ["Anschrift", `${c.street}, ${c.zip} ${c.city}`],
            ["Gläubiger-Identifikationsnr.", c.creditor_id || "–"],
            ["Mandatsreferenz", input.mandate_reference ?? "wird mit der Unterschrift vergeben"],
          ] as [string, string][]
        ).map(([label, value]) => (
          <View key={label} style={s.row}>
            <Text style={s.label}>{label}</Text>
            <Text style={s.value}>{value}</Text>
          </View>
        ))}
      </View>

      {SEPA_TEXT.replaceAll("{Gläubiger}", c.name)
        .split("\n")
        .map((p, i) => (
          <Text key={i} style={[s.para, i ? { color: EARTH } : {}]}>
            {p}
          </Text>
        ))}

      <View style={[s.box, { marginTop: 10 }]}>
        <Text style={[s.eyebrow, { marginBottom: 6 }]}>Zahlungspflichtiger</Text>
        {debtor.map(([label, value]) => (
          <View key={label} style={s.row}>
            <Text style={s.label}>{label}</Text>
            {value ? <Text style={s.value}>{value}</Text> : <View style={s.blank} />}
          </View>
        ))}
      </View>

      <View style={s.signRow} wrap={false}>
        <View style={[s.signCol, { marginRight: 24 }]}>
          <View style={s.signBox}>
            <Text style={{ fontWeight: 400 }}>{input.customer_signed_at ? `${sepa?.city || to.lines.at(-1) || ""}, ${date(input.customer_signed_at)}` : ""}</Text>
          </View>
          <Text style={s.signLabel}>Ort, Datum</Text>
        </View>
        <View style={s.signCol}>
          <Stamp image={input.customer_signature} id={input.field_ids.sepa} />
          <Text style={s.signLabel}>Unterschrift Kontoinhaber · {sepa?.holder || input.signer_name}</Text>
        </View>
      </View>
    </Page>
  );
}

const EVENT_LABEL: Record<string, string> = {
  erstellt: "Mappe erstellt und von der Agentur unterschrieben",
  versendet: "Link zur Unterschrift versendet",
  geoeffnet: "Mappe geöffnet",
  angenommen: "Angebot bestätigt, weiter zur Unterschrift",
  zugestimmt: "Elektronischer Unterschrift zugestimmt",
  unterschrieben: "Unterschrieben (Angebot angenommen, Vertrag und Mandat erteilt)",
  abgelehnt: "Abgelehnt",
  versiegelt: "Versiegelt und abgelegt",
};

const PROTOCOL_FIELD: Record<SignField, string> = { angebot: "Annahme", vertrag: "Vertrag", sepa: "SEPA-Mandat" };

function ProtocolPage({ input }: { input: BundleInput }) {
  const signed = input.audit?.find((e) => e.event === "unterschrieben");
  return (
    <Page size="A4" style={s.page}>
      <Chrome title="Abschlussprotokoll" input={input} />
      <Text style={s.eyebrow}>Nachweis</Text>
      <Text style={s.title}>
        Abschlussprotokoll
        <Text style={s.dot}>.</Text>
      </Text>
      <Text style={{ color: EARTH, marginTop: 4, marginBottom: 14, lineHeight: "12pt" }}>
        Elektronische Unterschrift über sign.grid-agency.de. Das Dokument ist mit dem Siegel von {input.settings.company.name} versehen; jede nachträgliche
        Änderung macht das Siegel ungültig.
      </Text>

      <View style={s.box}>
        {(
          [
            ["Mappe", input.id],
            ["Inhalt", `Angebot ${input.offer.number ?? ""}, ${input.contract.title}${input.sepa_required ? ", SEPA-Lastschriftmandat" : ""}`],
            ["Agentur", `${input.grid_signer} · ${dateTime(input.grid_signed_at)}`],
            ["Prüf-ID Agentur", input.grid_id],
            ["Kunde", `${input.signer_name} · ${input.signer_email}`],
            ...(Object.entries(input.field_ids) as [SignField, string][]).map(([field, id]) => [`Prüf-ID ${PROTOCOL_FIELD[field]}`, id] as [string, string]),
            ["Unterschrieben", signed ? `${dateTime(signed.at)} · IP ${signed.ip ?? "–"}` : "–"],
            ["SHA-256 vor Unterschrift", input.unsigned_hash ?? "–"],
            ["Siegel-Zertifikat (SHA-256)", input.seal_fingerprint ?? "–"],
          ] as [string, string][]
        ).map(([label, value]) => (
          <View key={label} style={s.row}>
            <Text style={s.label}>{label}</Text>
            <Text style={[s.value, label.startsWith("SHA") || label.startsWith("Siegel") || label.startsWith("Prüf-ID") ? s.mono : {}]}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={[s.eyebrow, { marginBottom: 4 }]}>Verlauf</Text>
      {(input.audit ?? []).map((e, i) => (
        <View key={i} style={s.event} wrap={false}>
          <Text style={{ width: 110 }}>{dateTime(e.at)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 400 }}>
              {e.event === "feld" ? `Unterschrift gesetzt: ${e.detail} · ID ${e.ref}` : (EVENT_LABEL[e.event] ?? e.event)}
              {e.by ? ` · ${e.by}` : ""}
            </Text>
            {(e.ip || e.ua || e.detail) && (
              <Text style={{ color: EARTH, fontSize: 6.6 }}>{[e.event === "feld" ? null : e.detail, e.ip && `IP ${e.ip}`, e.ua].filter(Boolean).join(" · ")}</Text>
            )}
          </View>
        </View>
      ))}
    </Page>
  );
}

export function renderBundle(input: BundleInput) {
  const c = input.settings.company;
  return renderToBuffer(
    <Document title={`Angebot ${input.offer.number ?? ""} · ${input.contract.title}`} author={c.name} creator={c.name} producer="GRID sign" language="de-DE">
      <InvoicePage doc={input.offer} settings={input.settings} payment={input.sepa_required ? "sepa" : "ueberweisung"} extra={<Acceptance input={input} />} />
      <ContractPages input={input} />
      {input.sepa_required && <SepaPage input={input} />}
      {input.final && <ProtocolPage input={input} />}
    </Document>
  );
}

export type BundlePart = "angebot" | "vertrag" | "sepa";

export const PART_FILE: Record<BundlePart, string> = { angebot: "Angebot", vertrag: "Agenturvertrag", sepa: "SEPA-Mandat" };

/** Ein Dokument der Mappe als eigenes PDF (für Abschlussmail und Kundenakte),
 * nach der Unterschrift mit dem Abschlussprotokoll am Ende */
export function renderPart(input: BundleInput, part: BundlePart) {
  const c = input.settings.company;
  const title = part === "angebot" ? `Angebot ${input.offer.number ?? ""}` : part === "vertrag" ? input.contract.title : "SEPA-Lastschriftmandat";
  return renderToBuffer(
    <Document title={title} author={c.name} creator={c.name} producer="GRID sign" language="de-DE">
      {part === "angebot" && (
        <InvoicePage doc={input.offer} settings={input.settings} payment={input.sepa_required ? "sepa" : "ueberweisung"} extra={<Acceptance input={input} />} />
      )}
      {part === "vertrag" && <ContractPages input={input} />}
      {part === "sepa" && <SepaPage input={input} />}
      {input.final && <ProtocolPage input={input} />}
    </Document>
  );
}
