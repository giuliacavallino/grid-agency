import "server-only";
import path from "node:path";
import { Document, Font, Image, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { KIND_LABEL, computeTotals, fillText, money, plain, type BillingDetail, type BillingSettings } from "@/lib/billing";
import { LOGO_PNG, LOGO_SNOW_PNG, MONOGRAM_PNG } from "./pdf-logo";

// Rechnungspapier im Look von grid-agency.de: dunkler Kopf mit Geisterwort,
// Empfänger als Headline, Gesamtbetrag rechts; darunter Belegdaten über die
// volle Breite, Leistungen, Zahlungsbox mit GiroCode und dunkle Summenkarte.
// Folgeseiten bekommen einen schmalen Kopf.

const FONTS = path.join(process.cwd(), "src/lib/server/fonts");
Font.register({
  family: "Readex",
  fonts: [300, 400, 500, 600].map((fontWeight) => ({ src: path.join(FONTS, `ReadexPro-${fontWeight}.ttf`), fontWeight })),
});
// Deutsche Wörter nicht nach englischen Regeln trennen
Font.registerHyphenationCallback((word) => [word]);

// Farben der Website
export const SKY = "#2b2926";
export const SNOW = "#e4e2e7";
export const DUNE = "#afaaa0";
export const EARTH = "#676159";
export const DAWN = "#e2e0dc";
export const GHOST = "#35322f";
export const PALE = "#f2f1ef";

const L = 56;
const R = 48;
const A4_WIDTH = 595.28;
const BAND = 150;
const TOP = 66;

// Zeilenhöhen nur an einzelnen Texten und in pt: an Seite oder View gesetzt
// fehlt in react-pdf die Seitenzahl, als Faktor werden Umbrüche zu groß
const s = StyleSheet.create({
  page: { fontFamily: "Readex", fontWeight: 300, fontSize: 9, color: SKY, paddingTop: TOP, paddingLeft: L, paddingRight: R, paddingBottom: 78 },
  band: { position: "absolute", top: 0, left: 0, width: A4_WIDTH, height: BAND, backgroundColor: SKY },
  // Breite reicht über das letzte Zeichen hinaus, sonst schneidet react-pdf den Bogen ab
  ghost: { position: "absolute", top: 40, left: L, right: R - 10, paddingRight: 6, textAlign: "right", fontWeight: 500, color: GHOST, letterSpacing: -1.2 },
  bandTop: { position: "absolute", top: 26, left: L, right: R, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bandBottom: { position: "absolute", left: L, right: R, bottom: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  agency: { fontSize: 5.2, letterSpacing: 2.8, color: SNOW, marginTop: 2, marginLeft: 1 },
  eyebrow: { fontSize: 6.6, letterSpacing: 2.2, textTransform: "uppercase", color: DUNE },
  eyebrowDark: { fontSize: 6.6, letterSpacing: 2.2, textTransform: "uppercase", color: EARTH },
  headline: { fontSize: 21, fontWeight: 500, color: SNOW, letterSpacing: -0.5, marginTop: 5 },
  bandNote: { fontSize: 8.5, color: DUNE, marginTop: 3 },
  pill: { backgroundColor: SNOW, borderRadius: 20, paddingVertical: 5, paddingLeft: 12, paddingRight: 5, flexDirection: "row", alignItems: "center" },
  dot: { width: 15, height: 15, borderRadius: 8, backgroundColor: SKY, marginLeft: 7, alignItems: "center", justifyContent: "center" },
  draft: { position: "absolute", top: 380, left: 0, right: 0, textAlign: "center", fontSize: 90, fontWeight: 600, color: "#efedea", transform: "rotate(-28deg)" },

  follow: { position: "absolute", top: 26, left: L, right: R },
  followRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottomWidth: 0.6, borderBottomColor: DAWN },

  sender: { fontSize: 6.2, color: EARTH, marginBottom: 8 },
  meta: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 9, marginBottom: 14, borderBottomWidth: 0.6, borderBottomColor: DAWN },
  metaValue: { fontSize: 9, fontWeight: 400, marginTop: 2 },
  title: { fontSize: 11, fontWeight: 500, marginBottom: 6 },
  intro: { lineHeight: "13pt", marginBottom: 12 },

  th: { flexDirection: "row", paddingBottom: 5, borderBottomWidth: 0.8, borderBottomColor: SKY },
  row: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 0.6, borderBottomColor: DAWN },
  num: { width: 24, fontSize: 7, letterSpacing: 1.4, color: EARTH, paddingTop: 2 },
  itemTitle: { fontSize: 9.5, fontWeight: 500, lineHeight: "12.5pt" },
  itemText: { fontSize: 8.2, color: EARTH, marginTop: 2, lineHeight: "11.5pt" },
  itemCalc: { fontSize: 7.2, color: DUNE, marginTop: 3 },
  amount: { width: 76, textAlign: "right", fontSize: 9.5, fontWeight: 400 },

  bottom: { flexDirection: "row", marginTop: 12 },
  pay: { flex: 1, backgroundColor: PALE, borderRadius: 12, padding: 12, marginRight: 10, flexDirection: "row" },
  payLead: { fontSize: 9, fontWeight: 500, marginTop: 4, lineHeight: "12.5pt" },
  payText: { fontSize: 7.6, color: EARTH, marginTop: 5, lineHeight: "11pt" },
  qr: { backgroundColor: "#ffffff", borderRadius: 8, padding: 5, alignSelf: "center" },
  sum: { width: 180, backgroundColor: SKY, borderRadius: 12, padding: 12 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  sumTotal: { fontSize: 18, fontWeight: 500, color: SNOW, letterSpacing: -0.4, marginTop: 3 },
  closing: { lineHeight: "13pt", marginTop: 14 },

  footer: { position: "absolute", left: L, right: R, bottom: 24, flexDirection: "row", fontSize: 6.4, color: EARTH },
  footerCol: { flex: 1, paddingRight: 12, lineHeight: "9pt" },
  footerHead: { color: SKY, fontWeight: 500 },
  pageNo: { position: "absolute", right: R, bottom: 12, fontSize: 6.2, color: DUNE },
});

const dateDe = (value: string | null | undefined) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
const qty = (value: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);

const DOC_TITLE: Partial<Record<BillingDetail["kind"], string>> = { storno: "Stornorechnung", storno_gutschrift: "Storno Gutschrift" };
const GHOST_WORD: Partial<Record<BillingDetail["kind"], string>> = { storno: "STORNO", storno_gutschrift: "STORNO", gutschrift: "GUTSCHRIFT", angebot: "ANGEBOT" };

function recipient(doc: BillingDetail) {
  const a = doc.address ?? {};
  const name = a.company_name || doc.customer_name || "";
  const person = [a.first_name, a.last_name].filter(Boolean).join(" ");
  const rest = [person, a.suffix_1, a.suffix_2, a.street, [a.zip_code, a.city].filter(Boolean).join(" "), a.country && a.country !== "DE" ? a.country : null].filter(
    (line): line is string => !!line?.trim()
  );
  return { name, rest };
}

/** GiroCode (EPC-QR): Banking-Apps übernehmen Empfänger, IBAN, Betrag und Zweck */
function giroCode(settings: BillingSettings, amount: number, purpose: string) {
  const c = settings.company;
  const payload = ["BCD", "002", "1", "SCT", c.bic.replace(/\s/g, ""), c.name.slice(0, 70), c.iban.replace(/\s/g, ""), `EUR${amount.toFixed(2)}`, "", "", purpose.slice(0, 140)].join("\n");
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 0, width: 280, color: { dark: SKY, light: "#ffffff" } });
}

export type PdfInput = {
  doc: BillingDetail;
  settings: BillingSettings;
  /** Nummer und Datum des Originals (Storno, Gutschrift, Korrektur) */
  reference?: { label: string; number: string | null; date: string | null } | null;
  qr?: string | null;
  /** Zahlungsart im Angebot; Standard SEPA-Lastschrift */
  payment?: "sepa" | "ueberweisung";
};

/** Eine Belegseite (Rechnung, Storno, Gutschrift, Angebot); auch Teil der Unterschriftsmappe */
export function InvoicePage({ doc, settings, reference, qr, payment = "sepa" }: PdfInput) {
  const c = settings.company;
  const title = DOC_TITLE[doc.kind] ?? KIND_LABEL[doc.kind];
  const label = `${title} ${doc.number ?? "(Entwurf)"}`;
  const ghost = GHOST_WORD[doc.kind] ?? "RECHNUNG";
  const totals = computeTotals(doc.items);
  const context = { ...doc, reference: reference?.number ?? null };
  const to = recipient(doc);
  const positions = doc.items.filter((i) => i.kind === "position");
  const payable = doc.kind === "rechnung" && totals.gross > 0;
  const service = doc.service_text
    ? plain(doc.service_text)
    : doc.service_from
      ? doc.service_to && doc.service_to !== doc.service_from
        ? `${shortDate(doc.service_from)} – ${dateDe(doc.service_to)}`
        : dateDe(doc.service_from)
      : "wie Rechnungsdatum";
  const meta: [string, string][] = [
    [`${KIND_LABEL[doc.kind]}snr.`, doc.number ?? "Entwurf"],
    ["Datum", dateDe(doc.document_date) || "–"],
    ...(doc.kind === "angebot"
      ? ([["Gültig bis", dateDe(doc.due_date) || "–"], ...(doc.service_from ? [["Leistungsbeginn", dateDe(doc.service_from)]] : [])] as [string, string][])
      : ([["Leistung", service]] as [string, string][])),
    ...(reference ? ([["Bezug", `${reference.label} ${reference.number ?? ""}`.trim()]] as [string, string][]) : []),
    ...(doc.customer_number ? ([["Kundennr.", doc.customer_number]] as [string, string][]) : []),
  ];

  return (
      <Page size="A4" style={s.page}>
        {/* Kopf der ersten Seite */}
        <View style={s.band}>
          <Text style={[s.ghost, { fontSize: Math.min(78, Math.round(480 / (ghost.length * 0.7))) }]}>{ghost}</Text>
          <View style={s.bandTop}>
            <View>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
              <Image src={LOGO_SNOW_PNG} style={{ width: 58, height: 21 }} />
              <Text style={s.agency}>AGENCY</Text>
            </View>
            <View style={s.pill}>
              <Text style={{ fontSize: 8.5, fontWeight: 500, color: SKY }}>{label}</Text>
              <View style={s.dot}>
                <Svg width={8} height={8} viewBox="0 0 24 24">
                  <Path d="M5 12h14M13 6l6 6-6 6" stroke={SNOW} strokeWidth={2.8} fill="none" />
                </Svg>
              </View>
            </View>
          </View>
          <View style={s.bandBottom}>
            <View style={{ maxWidth: 310 }}>
              <Text style={s.eyebrow}>{title} für</Text>
              <Text style={s.headline}>
                {to.name.replace(/\.$/, "")}
                <Text style={{ color: DUNE }}>.</Text>
              </Text>
              <Text style={s.bandNote}>{to.rest.join(" · ")}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.eyebrow}>Gesamtbetrag</Text>
              <Text style={s.headline}>{money(totals.gross, doc.currency)}</Text>
              <Text style={s.bandNote}>
                {payable && doc.due_date
                  ? `fällig am ${dateDe(doc.due_date)}`
                  : doc.kind === "angebot" && doc.due_date
                    ? `gültig bis ${dateDe(doc.due_date)}`
                    : `inkl. ${money(totals.vat, doc.currency)} USt`}
              </Text>
            </View>
          </View>
        </View>

        {/* Folgeseiten: schmaler Kopf statt Band */}
        <View
          fixed
          style={s.follow}
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <View style={s.followRow}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
                <Image src={LOGO_PNG} style={{ width: 44, height: 16 }} />
                <Text style={{ fontSize: 7.5, color: EARTH }}>
                  {label} · {to.name} · Seite {pageNumber}
                </Text>
              </View>
            ) : null
          }
        />
        {!doc.number && (
          <Text style={s.draft} fixed>
            ENTWURF
          </Text>
        )}

        <View style={{ height: BAND - TOP + 14 }} />
        <Text style={s.sender}>
          {c.name} · {c.street} · {c.zip} {c.city}
        </Text>
        <View style={s.meta}>
          {meta.map(([key, value], i) => (
            <View key={key} style={{ alignItems: i === 0 ? "flex-start" : i === meta.length - 1 ? "flex-end" : "center" }}>
              <Text style={s.eyebrowDark}>{key}</Text>
              <Text style={s.metaValue}>{value}</Text>
            </View>
          ))}
        </View>

        {doc.title && <Text style={s.title}>{plain(fillText(doc.title, context, c))}</Text>}
        {fillText(doc.intro, context, c) && <Text style={s.intro}>{plain(fillText(doc.intro, context, c))}</Text>}

        <View style={s.th} fixed>
          <Text style={[s.eyebrowDark, { width: 24 }]}>Nr.</Text>
          <Text style={[s.eyebrowDark, { flex: 1 }]}>Leistung</Text>
          <Text style={[s.eyebrowDark, { width: 76, textAlign: "right" }]}>Betrag</Text>
        </View>
        {doc.items.map((item) => {
          const text = plain(fillText(item.description, context, c));
          if (item.kind === "text") {
            return (
              <View key={item.id} style={s.row} wrap={false}>
                <Text style={{ width: 24 }} />
                <Text style={[s.itemText, { flex: 1, marginTop: 0 }]}>{text}</Text>
              </View>
            );
          }
          const [first, ...rest] = text.split("\n");
          const more = rest.join("\n").trim();
          const discount = item.discount ? ` · abzgl. ${item.discount_type === "betrag" ? money(item.discount, doc.currency) : `${qty(item.discount)} %`} Rabatt` : "";
          const vat = totals.byRate.length > 1 ? ` · ${qty(item.vat_percent)} % USt` : "";
          return (
            <View key={item.id} style={s.row} wrap={false}>
              <Text style={s.num}>{String(positions.indexOf(item) + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1, paddingRight: 14 }}>
                <Text style={s.itemTitle}>{first || item.number || "Position"}</Text>
                {more && <Text style={s.itemText}>{more}</Text>}
                <Text style={s.itemCalc}>
                  {qty(item.quantity)}
                  {item.unit ? ` ${item.unit}` : ""} × {money(item.unit_price_net, doc.currency)}
                  {discount}
                  {vat}
                </Text>
              </View>
              <Text style={s.amount}>{money(item.total_net, doc.currency)}</Text>
            </View>
          );
        })}

        <View style={s.bottom} wrap={false}>
          {payable ? (
            <View style={s.pay}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={s.eyebrowDark}>Zahlung</Text>
                <Text style={s.payLead}>{doc.due_date ? `Bitte überweisen bis zum ${dateDe(doc.due_date)}.` : "Bitte überweisen Sie den Gesamtbetrag."}</Text>
                <Text style={s.payText}>
                  {c.name} · {c.bank}
                  {"\n"}IBAN {c.iban} · BIC {c.bic}
                  {"\n"}Verwendungszweck: {label}
                </Text>
              </View>
              {qr && (
                <View style={s.qr}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
                  <Image src={qr} style={{ width: 52, height: 52 }} />
                </View>
              )}
            </View>
          ) : doc.kind === "angebot" ? (
            <View style={s.pay}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={s.eyebrowDark}>Zahlungsart</Text>
                <Text style={s.payLead}>{payment === "sepa" ? "SEPA-Lastschrift." : "Überweisung."}</Text>
                <Text style={s.payText}>
                  {payment === "sepa"
                    ? "Die Rechnungsbeträge ziehen wir per SEPA-Basislastschrift ein. Das Mandat erteilen Sie mit der Annahme dieses Angebots."
                    : `Nach Rechnung auf ${c.bank} · IBAN ${c.iban}.`}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <View style={s.sum}>
            <View style={s.sumRow}>
              <Text style={{ color: DUNE }}>Netto</Text>
              <Text style={{ color: SNOW }}>{money(totals.net, doc.currency)}</Text>
            </View>
            {totals.byRate.map((r) => (
              <View key={r.rate} style={s.sumRow}>
                <Text style={{ color: DUNE }}>USt {qty(r.rate)} %</Text>
                <Text style={{ color: SNOW }}>{money(r.vat, doc.currency)}</Text>
              </View>
            ))}
            <Text style={[s.eyebrow, { marginTop: 8 }]}>Gesamtbetrag</Text>
            <Text style={s.sumTotal}>{money(totals.gross, doc.currency)}</Text>
          </View>
        </View>

        {fillText(doc.closing, context, c) && (
          <Text style={s.closing} wrap={false}>
            {plain(fillText(doc.closing, context, c))}
          </Text>
        )}

        <View style={s.footer} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
          <Image src={MONOGRAM_PNG} style={{ width: 16, height: 9, marginRight: 10, marginTop: 1 }} />
          <View style={[s.footerCol, { flex: 1.3 }]}>
            <Text style={s.footerHead}>{c.name}</Text>
            <Text>
              {c.street}, {c.zip} {c.city}
            </Text>
            <Text>{[c.email, c.phone, c.website].filter(Boolean).join(" · ")}</Text>
          </View>
          <View style={s.footerCol}>
            <Text style={s.footerHead}>{c.bank}</Text>
            <Text>{c.iban}</Text>
            <Text>BIC {c.bic}</Text>
          </View>
          <View style={[s.footerCol, { flex: 1.3, paddingRight: 0 }]}>
            <Text style={s.footerHead}>
              USt-IdNr. {c.vat_id} · St.-Nr. {c.tax_number}
            </Text>
            <Text>{c.register}</Text>
            <Text>Geschäftsführung: {c.managing_director}</Text>
          </View>
        </View>
        <Text style={s.pageNo} fixed render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
      </Page>
  );
}

function InvoicePdf(props: PdfInput) {
  const c = props.settings.company;
  const title = DOC_TITLE[props.doc.kind] ?? KIND_LABEL[props.doc.kind];
  return (
    <Document title={`${title} ${props.doc.number ?? "(Entwurf)"}`} author={c.name} creator={c.name} producer="GRID Intranet" language="de-DE">
      <InvoicePage {...props} />
    </Document>
  );
}

/** GiroCode für zahlbare Rechnungen, sonst null */
export async function invoiceQr(input: PdfInput) {
  const totals = computeTotals(input.doc.items);
  return input.doc.kind === "rechnung" && input.doc.number && totals.gross > 0 && input.settings.company.iban
    ? giroCode(input.settings, totals.gross, `${KIND_LABEL[input.doc.kind]} ${input.doc.number}`)
    : null;
}

export async function renderInvoicePdf(input: PdfInput) {
  return renderToBuffer(<InvoicePdf {...input} qr={await invoiceQr(input)} />);
}
