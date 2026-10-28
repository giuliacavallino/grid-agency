import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DOMAIN } from "@/lib/config";

export type Classification = {
  classification: "anfrage" | "bewerbung" | "rechnung" | "sonstiges";
  reason: string;
  /** Anfrage: anfragende Person; Bewerbung: Bewerber*in */
  contact_name: string | null;
  company: string | null;
  phone: string | null;
  /** Bewerbung: Stelle bzw. Art der Bewerbung */
  position_title: string | null;
  /** Rechnung: Angaben aus Mail und Betreff */
  invoice: {
    vendor: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    due_date: string | null;
    amount: number | null;
    currency: string | null;
    description: string | null;
  } | null;
};

export type Mail = {
  mailbox: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  attachments: string[];
};

const SYSTEM = `Du sortierst eingehende E-Mails in den Postfächern von GRID, einer Social-Media- und Kommunikationsagentur in Berlin und Frankfurt (Domain ${DOMAIN}). Postfächer: hello@ (allgemein), giulia.cavallino@ (Geschäftsführerin), buchhaltung@ (Rechnungen), google@ (Google-Konto, Formulare).

Kategorien:
- "anfrage": Ein mögliches Kundenunternehmen oder eine Person interessiert sich für Leistungen von GRID (Social-Media-Betreuung, Content, Ads, Influencer, Events, Strategie, Rebranding), fragt nach Preisen, Angebot, Termin oder Zusammenarbeit. Auch Weiterempfehlungen mit konkretem Bedarf. Keine bestehenden Kund*innen in laufenden Projekten.
- "bewerbung": Bewerbungen und Initiativbewerbungen (Job, Praktikum, Werkstudium, Freelance-Anfragen von Kreativen, die für GRID arbeiten wollen), auch wenn sie "Anfrage" im Betreff tragen.
- "rechnung": Eine Rechnung AN GRID, die bezahlt werden muss oder bereits abgebucht wurde (Lieferanten, Software-Abos, Freelancer, Miete, Telefon). Meist mit PDF-Anhang. Keine Mahnungen ohne neue Rechnung, keine Angebote, keine Zahlungsbestätigungen ohne Rechnung, keine Rechnungen, die GRID selbst verschickt.
- "sonstiges": Alles andere – Newsletter, Werbung, Antworten in laufenden Gesprächen, Kund*innen-Kommunikation, private Mails, automatische Benachrichtigungen, Spam.

Fülle nur Felder, die in der Mail oder den Dateinamen der Anhänge stehen. Bei "rechnung" das Feld invoice: Rechnungssteller, Rechnungsnummer, Rechnungsdatum und Fälligkeit als YYYY-MM-DD, Bruttobetrag als Zahl, Währung (ISO, meist EUR), kurze Beschreibung der Leistung. Bei allen anderen Kategorien sind alle Felder von invoice null. Bei "bewerbung" position_title mit der Stelle. Die Begründung ist ein kurzer deutscher Satz.`;

const nullable = (type: string) => ({ type: [type, "null"] });

const SCHEMA = {
  type: "object",
  properties: {
    classification: { type: "string", enum: ["anfrage", "bewerbung", "rechnung", "sonstiges"] },
    reason: { type: "string" },
    contact_name: nullable("string"),
    company: nullable("string"),
    phone: nullable("string"),
    position_title: nullable("string"),
    // Immer ein Objekt; außer bei "rechnung" sind alle Felder null
    invoice: {
      type: "object",
      properties: {
        vendor: nullable("string"),
        invoice_number: nullable("string"),
        invoice_date: nullable("string"),
        due_date: nullable("string"),
        amount: nullable("number"),
        currency: nullable("string"),
        description: nullable("string"),
      },
      required: ["vendor", "invoice_number", "invoice_date", "due_date", "amount", "currency", "description"],
      additionalProperties: false,
    },
  },
  required: ["classification", "reason", "contact_name", "company", "phone", "position_title", "invoice"],
  additionalProperties: false,
};

const AUTOMATED = /(no-?reply|mailer-daemon|postmaster|notifications?@|newsletter|bounce)/i;
const APPLICATION = /(bewerb|initiativ|lebenslauf|\bcv\b|praktikum|werkstudent|ausbildung|application|portfolio anbei)/i;
const INQUIRY = /(angebot|anfrage|zusammenarbeit|betreuung|social media|instagram|tiktok|budget|preis|kosten|agentur|kampagne|content|reels?)/i;
const INVOICE = /(rechnung|invoice|beleg|abrechnung|receipt)/i;

const empty = { company: null, phone: null, position_title: null, invoice: null };

/** Regelbasierte Einordnung als Rückfall ohne API-Key oder bei Fehlern. */
function heuristic(mail: Mail): Classification {
  const text = `${mail.subject}\n${mail.body}\n${mail.attachments.join(" ")}`;
  const base = { ...empty, contact_name: mail.fromName || null };
  if (INVOICE.test(text) && (mail.attachments.length > 0 || mail.mailbox.startsWith("buchhaltung@"))) {
    return {
      ...base,
      classification: "rechnung",
      reason: "Stichworte einer Rechnung (Regel)",
      invoice: { vendor: mail.fromName || mail.fromEmail, invoice_number: null, invoice_date: null, due_date: null, amount: null, currency: "EUR", description: mail.subject || null },
    };
  }
  if (AUTOMATED.test(mail.fromEmail)) return { ...base, classification: "sonstiges", reason: "Automatische Mail (Regel)" };
  if (APPLICATION.test(text)) return { ...base, classification: "bewerbung", reason: "Stichworte einer Bewerbung (Regel)" };
  if (INQUIRY.test(text)) return { ...base, classification: "anfrage", reason: "Stichworte einer Kundenanfrage (Regel)" };
  return { ...base, classification: "sonstiges", reason: "Keine Anfrage erkannt (Regel)" };
}

let client: Anthropic | null = null;

/** Ordnet eine eingehende Mail ein: Anfrage (→ Lead), Bewerbung (→ Personal),
 * Rechnung (→ Finance) oder Sonstiges. */
export async function classifyMail(mail: Mail): Promise<Classification> {
  const sender = mail.fromEmail.toLowerCase();
  const internal = sender.endsWith(`@${DOMAIN}`);
  // Interne Mails sind nie Anfragen oder Bewerbungen, aber weitergeleitete
  // Rechnungen (z. B. an buchhaltung@) sollen erfasst werden.
  if (internal && !INVOICE.test(`${mail.subject} ${mail.attachments.join(" ")}`)) {
    return { ...empty, classification: "sonstiges", reason: "Interne Mail", contact_name: null };
  }

  let result: Classification;
  if (!process.env.ANTHROPIC_API_KEY) {
    result = heuristic(mail);
  } else {
    client ??= new Anthropic();
    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 2048,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              `Postfach: ${mail.mailbox}`,
              `Von: ${mail.fromName} <${mail.fromEmail}>`,
              `Betreff: ${mail.subject}`,
              `Anhänge: ${mail.attachments.length ? mail.attachments.join(", ") : "keine"}`,
              "",
              mail.body.slice(0, 12_000),
            ].join("\n"),
          },
        ],
      });
      const text = response.content.find((block) => block.type === "text");
      result =
        response.stop_reason === "refusal" || !text || text.type !== "text"
          ? heuristic(mail)
          : (JSON.parse(text.text) as Classification);
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        console.error(`Klassifizierung fehlgeschlagen (${error.status}):`, error.message);
      } else {
        console.error("Klassifizierung fehlgeschlagen:", error);
      }
      result = heuristic(mail);
    }
  }

  if (internal && result.classification !== "rechnung") {
    return { ...result, classification: "sonstiges", reason: "Interne Mail" };
  }
  return result;
}
