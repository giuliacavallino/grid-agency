import "server-only";
import path from "node:path";
import { Document, Font, Image, Defs, LinearGradient, Page, Rect, Stop, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { KIND_LABEL, computeTotals, fillText, money, plain, type BillingDetail, type BillingSettings } from "@/lib/billing";
import { LOGO_PNG, MONOGRAM_PNG } from "./pdf-logo";

// Rechnungspapier im GRID-Design: Readex Pro, Aurora-Verlauf als Akzent,
// Anschrift im Fensterbereich nach DIN 5008 (Falz- und Lochmarken), Positionen,
// Summen, Zahlungsbox mit GiroCode und Fußzeile mit allen Pflichtangaben.

const FONTS = path.join(process.cwd(), "src/lib/server/fonts");
Font.register({
  family: "Readex",
  fonts: [300, 400, 500, 600].map((fontWeight) => ({ src: path.join(FONTS, `ReadexPro-${fontWeight}.ttf`), fontWeight })),
});
// Deutsche Wörter nicht nach englischen Regeln trennen
Font.registerHyphenationCallback((word) => [word]);

// Markenfarben (Sky, Earth, Dune, Dawn) und Aurora
const INK = "#2b2926";
const EARTH = "#676159";
const DUNE = "#afaaa0";
const DAWN = "#e4e2dd";
const TINT = "#f5f3f0";
const AURORA = ["#feda75", "#fa7e1e", "#d62976", "#962fbf"];

const LEFT = 70; // 25 mm wie DIN 5008
const RIGHT = 50;
const A4_WIDTH = 595.28;

// Zeilenhöhen nur an einzelnen Texten und in pt: an Seite oder View gesetzt
// fehlt in react-pdf die Seitenzahl, als Faktor werden Umbrüche zu groß
const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 96, paddingLeft: LEFT, paddingRight: RIGHT, fontFamily: "Readex", fontWeight: 300, fontSize: 9, color: INK },
  aurora: { position: "absolute", top: 0, left: 0 },
  fold: { position: "absolute", left: 22, width: 10, height: 0.6, backgroundColor: DUNE },
  monogram: { position: "absolute", left: LEFT, bottom: 14, width: 16 },
  continued: { position: "absolute", top: 22, left: LEFT, right: RIGHT, fontSize: 7, color: DUNE, textAlign: "right" },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", height: 74 },
  logo: { width: 86 },
  docType: { fontSize: 22, fontWeight: 600, letterSpacing: -0.4, textAlign: "right" },
  docNumber: { fontSize: 10, color: EARTH, textAlign: "right", marginTop: 2 },

  head: { flexDirection: "row", justifyContent: "space-between", minHeight: 128 },
  window: { width: 240 },
  sender: { fontSize: 6.5, color: EARTH, paddingBottom: 3, marginBottom: 7, borderBottomWidth: 0.5, borderBottomColor: DAWN },
  recipient: { fontSize: 10, lineHeight: "14pt" },
  recipientFirst: { fontSize: 10, fontWeight: 500, lineHeight: "14pt" },
  meta: { width: 196 },
  metaRow: { flexDirection: "row", paddingVertical: 2.4, borderBottomWidth: 0.5, borderBottomColor: DAWN },
  metaLabel: { width: 82, fontSize: 7, color: EARTH, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 1.5 },
  metaValue: { flex: 1, fontSize: 9, fontWeight: 400 },

  title: { fontSize: 12, fontWeight: 500, marginBottom: 6 },
  intro: { lineHeight: "13.5pt", marginBottom: 16 },

  tableHead: { flexDirection: "row", paddingBottom: 5, borderBottomWidth: 0.8, borderBottomColor: INK },
  th: { fontSize: 6.8, color: EARTH, textTransform: "uppercase", letterSpacing: 0.6 },
  row: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: DAWN },
  cPos: { width: 22, color: DUNE },
  cDesc: { flex: 1, paddingRight: 12 },
  cQty: { width: 62, textAlign: "right" },
  cPrice: { width: 72, textAlign: "right" },
  cTotal: { width: 76, textAlign: "right", fontWeight: 400 },
  itemTitle: { fontWeight: 500, lineHeight: "12.5pt" },
  itemText: { fontSize: 8.5, color: EARTH, marginTop: 2, lineHeight: "12pt" },

  totals: { alignSelf: "flex-end", width: 250, marginTop: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, paddingHorizontal: 10 },
  totalLabel: { color: EARTH },
  grand: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: TINT, borderRadius: 6 },
  grandLabel: { fontWeight: 500 },
  grandValue: { fontSize: 14, fontWeight: 600, letterSpacing: -0.2 },

  pay: { flexDirection: "row", marginTop: 20, padding: 12, borderWidth: 0.6, borderColor: DAWN, borderRadius: 8 },
  payText: { flex: 1, paddingRight: 12 },
  payLead: { fontSize: 9.5, lineHeight: "13.5pt", marginBottom: 8 },
  strong: { fontWeight: 500 },
  payRow: { flexDirection: "row", paddingVertical: 1.2 },
  payLabel: { width: 92, fontSize: 7, color: EARTH, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 1 },
  payValue: { flex: 1 },
  qr: { width: 74, alignItems: "center" },
  qrImage: { width: 70, height: 70 },
  qrCaption: { fontSize: 6, color: EARTH, textAlign: "center", marginTop: 3 },

  closing: { marginTop: 22, lineHeight: "13.5pt" },

  footer: { position: "absolute", left: LEFT, right: RIGHT, bottom: 30, flexDirection: "row", paddingTop: 8, borderTopWidth: 0.5, borderTopColor: DAWN },
  footerCol: { flex: 1, paddingRight: 8, fontSize: 6.6, color: EARTH, lineHeight: "9.5pt" },
  footerHead: { fontSize: 6.6, color: INK, fontWeight: 500, lineHeight: "9.5pt" },
  pageNo: { position: "absolute", right: RIGHT, bottom: 16, fontSize: 6.6, color: DUNE },
  draft: { position: "absolute", top: 360, left: 0, right: 0, textAlign: "center", fontSize: 90, fontWeight: 600, color: "#efece8", transform: "rotate(-28deg)" },
});

const dateDe = (value: string | null | undefined) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
const qty = (value: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);

const DOC_TITLE: Partial<Record<BillingDetail["kind"], string>> = { storno: "Stornorechnung", storno_gutschrift: "Storno Gutschrift" };
const TOTAL_LABEL: Partial<Record<BillingDetail["kind"], string>> = {
  gutschrift: "Gutschrift gesamt",
  storno: "Storno gesamt",
  storno_gutschrift: "Storno gesamt",
};

function addressLines(doc: BillingDetail) {
  const a = doc.address ?? {};
  const person = [a.first_name, a.last_name].filter(Boolean).join(" ");
  return [
    a.company_name || doc.customer_name,
    person,
    a.suffix_1,
    a.suffix_2,
    a.street,
    [a.zip_code, a.city].filter(Boolean).join(" "),
    a.country && a.country !== "DE" ? a.country : null,
  ].filter((line): line is string => !!line?.trim());
}

/** GiroCode (EPC-QR): Banking-Apps übernehmen Empfänger, IBAN, Betrag und Zweck */
function giroCode(settings: BillingSettings, amount: number, purpose: string) {
  const c = settings.company;
  const payload = ["BCD", "002", "1", "SCT", c.bic.replace(/\s/g, ""), c.name.slice(0, 70), c.iban.replace(/\s/g, ""), `EUR${amount.toFixed(2)}`, "", "", purpose.slice(0, 140)].join("\n");
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 0, width: 280, color: { dark: INK, light: "#ffffff" } });
}

export type PdfInput = {
  doc: BillingDetail & { customer_number?: string | null };
  settings: BillingSettings;
  /** Nummer und Datum des Originals (Storno, Gutschrift, Korrektur) */
  reference?: { label: string; number: string | null; date: string | null } | null;
  qr?: string | null;
};

function InvoicePdf({ doc, settings, reference, qr }: PdfInput) {
  const c = settings.company;
  const title = DOC_TITLE[doc.kind] ?? KIND_LABEL[doc.kind];
  const totals = computeTotals(doc.items);
  const context = { ...doc, reference: reference?.number ?? null };
  const lines = addressLines(doc);
  const positions = doc.items.filter((i) => i.kind === "position");
  const service = doc.service_text
    ? plain(doc.service_text)
    : doc.service_from
      ? doc.service_to && doc.service_to !== doc.service_from
        ? `${dateDe(doc.service_from)} – ${dateDe(doc.service_to)}`
        : dateDe(doc.service_from)
      : "entspricht Rechnungsdatum";
  const payable = doc.kind === "rechnung" && totals.gross > 0;
  const meta: [string, string][] = [
    [`${KIND_LABEL[doc.kind]}snr.`, doc.number ?? "Entwurf"],
    ["Datum", dateDe(doc.document_date)],
    ["Leistung", service],
    ...(payable && doc.due_date ? ([["Fällig am", dateDe(doc.due_date)]] as [string, string][]) : []),
    ...(doc.customer_number ? ([["Kundennr.", doc.customer_number]] as [string, string][]) : []),
    ...(reference ? ([["Bezug", `${reference.label} ${reference.number ?? ""}${reference.date ? ` vom ${dateDe(reference.date)}` : ""}`]] as [string, string][]) : []),
  ];

  return (
    <Document title={`${title} ${doc.number ?? "Entwurf"}`} author={c.name} creator={c.name} producer="GRID Intranet" language="de-DE">
      <Page size="A4" style={s.page}>
        <Svg style={s.aurora} width={A4_WIDTH} height={5} fixed>
          <Defs>
            <LinearGradient id="aurora" x1="0" y1="0" x2="1" y2="0">
              {AURORA.map((color, i) => (
                <Stop key={color} offset={i / (AURORA.length - 1)} stopColor={color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={A4_WIDTH} height={5} fill="url(#aurora)" />
        </Svg>
        {/* Falzmarken (105 / 210 mm) und Lochmarke (148,5 mm) */}
        <View style={[s.fold, { top: 297.6 }]} fixed />
        <View style={[s.fold, { top: 420.9, width: 14 }]} fixed />
        <View style={[s.fold, { top: 595.3 }]} fixed />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
        <Image src={MONOGRAM_PNG} style={s.monogram} fixed />
        {!doc.number && (
          <Text style={s.draft} fixed>
            ENTWURF
          </Text>
        )}
        <Text style={s.continued} fixed render={({ pageNumber }) => (pageNumber > 1 ? `${title} ${doc.number ?? "Entwurf"} · Fortsetzung` : "")} />

        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
          <Image src={LOGO_PNG} style={s.logo} />
          <View>
            <Text style={s.docType}>{title}</Text>
            <Text style={s.docNumber}>{doc.number ? `Nr. ${doc.number}` : "Entwurf"}</Text>
          </View>
        </View>

        <View style={s.head}>
          <View style={s.window}>
            <Text style={s.sender}>
              {c.name} · {c.street} · {c.zip} {c.city}
            </Text>
            {lines.map((line, i) => (
              <Text key={i} style={i === 0 ? s.recipientFirst : s.recipient}>
                {line}
              </Text>
            ))}
          </View>
          <View style={s.meta}>
            {meta.map(([label, value]) => (
              <View key={label} style={s.metaRow}>
                <Text style={s.metaLabel}>{label}</Text>
                <Text style={s.metaValue}>{value || "–"}</Text>
              </View>
            ))}
          </View>
        </View>

        {doc.title && <Text style={s.title}>{plain(fillText(doc.title, context, c))}</Text>}
        {fillText(doc.intro, context, c) && <Text style={s.intro}>{plain(fillText(doc.intro, context, c))}</Text>}

        <View style={s.tableHead} fixed>
          <Text style={[s.th, s.cPos]}>Nr.</Text>
          <Text style={[s.th, s.cDesc]}>Leistung</Text>
          <Text style={[s.th, s.cQty]}>Menge</Text>
          <Text style={[s.th, s.cPrice]}>Einzelpreis</Text>
          <Text style={[s.th, s.cTotal]}>Betrag</Text>
        </View>
        {doc.items.map((item) => {
          const text = plain(fillText(item.description, context, c));
          if (item.kind === "text") {
            return (
              <View key={item.id} style={s.row} wrap={false}>
                <Text style={s.cPos} />
                <Text style={[s.cDesc, s.itemText, { marginTop: 0 }]}>{text}</Text>
              </View>
            );
          }
          const pos = positions.indexOf(item) + 1;
          const [first, ...rest] = text.split("\n");
          const discount = item.discount ? `abzgl. ${item.discount_type === "betrag" ? money(item.discount, doc.currency) : `${qty(item.discount)} %`} Rabatt` : "";
          const extra = [totals.byRate.length > 1 ? `${qty(item.vat_percent)} % USt` : "", discount].filter(Boolean).join(" · ");
          return (
            <View key={item.id} style={s.row}>
              <Text style={s.cPos}>{String(pos).padStart(2, "0")}</Text>
              <View style={s.cDesc}>
                <Text style={s.itemTitle}>{first || item.number || "Position"}</Text>
                {rest.join("\n").trim() && <Text style={s.itemText}>{rest.join("\n").trim()}</Text>}
                {extra && <Text style={s.itemText}>{extra}</Text>}
              </View>
              <Text style={s.cQty}>
                {qty(item.quantity)}
                {item.unit ? ` ${item.unit}` : ""}
              </Text>
              <Text style={s.cPrice}>{money(item.unit_price_net, doc.currency)}</Text>
              <Text style={s.cTotal}>{money(item.total_net, doc.currency)}</Text>
            </View>
          );
        })}

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Netto</Text>
            <Text>{money(totals.net, doc.currency)}</Text>
          </View>
          {totals.byRate.map((r) => (
            <View key={r.rate} style={s.totalRow}>
              <Text style={s.totalLabel}>Umsatzsteuer {qty(r.rate)} %</Text>
              <Text>{money(r.vat, doc.currency)}</Text>
            </View>
          ))}
          <View style={s.grand}>
            <Text style={s.grandLabel}>{TOTAL_LABEL[doc.kind] ?? "Gesamtbetrag"}</Text>
            <Text style={s.grandValue}>{money(totals.gross, doc.currency)}</Text>
          </View>
        </View>

        {payable && (
          <View style={s.pay} wrap={false}>
            <View style={s.payText}>
              <Text style={s.payLead}>
                Bitte überweisen Sie <Text style={s.strong}>{money(totals.gross, doc.currency)}</Text>
                {doc.due_date ? (
                  <>
                    {" "}
                    bis zum <Text style={s.strong}>{dateDe(doc.due_date)}</Text>
                  </>
                ) : null}
                .
              </Text>
              {[
                ["Empfänger", c.name],
                ["IBAN", c.iban],
                ["BIC", `${c.bic} · ${c.bank}`],
                ["Verwendungszweck", `${KIND_LABEL[doc.kind]} ${doc.number ?? ""}`.trim()],
              ].map(([label, value]) => (
                <View key={label} style={s.payRow}>
                  <Text style={s.payLabel}>{label}</Text>
                  <Text style={s.payValue}>{value}</Text>
                </View>
              ))}
            </View>
            {qr && (
              <View style={s.qr}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
                <Image src={qr} style={s.qrImage} />
                <Text style={s.qrCaption}>GiroCode · mit der Banking-App scannen</Text>
              </View>
            )}
          </View>
        )}

        {fillText(doc.closing, context, c) && <Text style={s.closing}>{plain(fillText(doc.closing, context, c))}</Text>}

        <View style={s.footer} fixed>
          <View style={[s.footerCol, { flex: 0.9 }]}>
            <Text style={s.footerHead}>{c.name}</Text>
            <Text>{c.street}</Text>
            <Text>
              {c.zip} {c.city}
            </Text>
          </View>
          <View style={[s.footerCol, { flex: 1.1 }]}>
            <Text style={s.footerHead}>Kontakt</Text>
            <Text>{c.website}</Text>
            <Text>{c.email}</Text>
            <Text>{c.phone}</Text>
          </View>
          <View style={[s.footerCol, { flex: 1.3 }]}>
            <Text style={s.footerHead}>Bankverbindung</Text>
            <Text>{c.bank}</Text>
            <Text>{c.iban}</Text>
            <Text>BIC {c.bic}</Text>
          </View>
          <View style={[s.footerCol, { flex: 1.5, paddingRight: 0 }]}>
            <Text style={s.footerHead}>Steuern und Register</Text>
            <Text>
              St.-Nr. {c.tax_number} · USt-IdNr. {c.vat_id}
            </Text>
            <Text>{c.register}</Text>
            <Text>Geschäftsführung: {c.managing_director}</Text>
          </View>
        </View>
        <Text style={s.pageNo} fixed render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(input: PdfInput) {
  const totals = computeTotals(input.doc.items);
  const qr =
    input.doc.kind === "rechnung" && input.doc.number && totals.gross > 0 && input.settings.company.iban
      ? await giroCode(input.settings, totals.gross, `${KIND_LABEL[input.doc.kind]} ${input.doc.number}`)
      : null;
  return renderToBuffer(<InvoicePdf {...input} qr={qr} />);
}
