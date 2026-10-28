import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DOMAIN } from "@/lib/config";

export type Classification = {
  classification: "anfrage" | "bewerbung" | "sonstiges";
  reason: string;
  contact_name: string | null;
  company: string | null;
  phone: string | null;
};

export type Mail = { fromName: string; fromEmail: string; subject: string; body: string };

const SYSTEM = `Du sortierst eingehende E-Mails an hello@${DOMAIN}, das allgemeine Postfach von GRID, einer Social-Media-Agentur in Berlin und Frankfurt.

Kategorien:
- "anfrage": Ein mögliches Kundenunternehmen oder eine Person interessiert sich für Leistungen von GRID (Social-Media-Betreuung, Content, Ads, Influencer, Events, Strategie), fragt nach Preisen, Angebot, Termin oder Zusammenarbeit. Auch Weiterempfehlungen mit konkretem Bedarf.
- "bewerbung": Bewerbungen und Initiativbewerbungen (Job, Praktikum, Werkstudium, Freelance-Anfragen von Kreativen, die für GRID arbeiten wollen), auch wenn sie "Anfrage" im Betreff tragen.
- "sonstiges": Alles andere – Newsletter, Rechnungen, Werbung von Dienstleistern an GRID, Kooperationsangebote von Tools/Agenturen, Antworten in laufenden Gesprächen, automatische Mails, Spam.

Gib den Namen der anfragenden Person, die Firma und eine Telefonnummer nur an, wenn sie in der Mail stehen. Die Begründung ist ein kurzer deutscher Satz.`;

const SCHEMA = {
  type: "object",
  properties: {
    classification: { type: "string", enum: ["anfrage", "bewerbung", "sonstiges"] },
    reason: { type: "string" },
    contact_name: { type: ["string", "null"] },
    company: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
  },
  required: ["classification", "reason", "contact_name", "company", "phone"],
  additionalProperties: false,
};

const AUTOMATED = /(no-?reply|mailer-daemon|postmaster|notifications?@|newsletter|bounce)/i;
const APPLICATION = /(bewerb|initiativ|lebenslauf|\bcv\b|praktikum|werkstudent|ausbildung|application|portfolio anbei)/i;
const INQUIRY = /(angebot|anfrage|zusammenarbeit|betreuung|social media|instagram|tiktok|budget|preis|kosten|agentur|kampagne|content|reels?)/i;

/** Regelbasierte Einordnung als Rückfall ohne API-Key oder bei Fehlern. */
function heuristic(mail: Mail): Classification {
  const text = `${mail.subject}\n${mail.body}`;
  const base = { contact_name: mail.fromName || null, company: null, phone: null };
  if (APPLICATION.test(text)) return { ...base, classification: "bewerbung", reason: "Stichworte einer Bewerbung (Regel)" };
  if (INQUIRY.test(text)) return { ...base, classification: "anfrage", reason: "Stichworte einer Kundenanfrage (Regel)" };
  return { ...base, classification: "sonstiges", reason: "Keine Anfrage erkannt (Regel)" };
}

let client: Anthropic | null = null;

/** Ordnet eine Mail an hello@ ein: Anfrage (→ Lead), Bewerbung oder Sonstiges. */
export async function classifyMail(mail: Mail): Promise<Classification> {
  const sender = mail.fromEmail.toLowerCase();
  if (sender.endsWith(`@${DOMAIN}`) || AUTOMATED.test(sender)) {
    return { classification: "sonstiges", reason: "Interne oder automatische Mail", contact_name: null, company: null, phone: null };
  }
  if (!process.env.ANTHROPIC_API_KEY) return heuristic(mail);

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
          content: `Von: ${mail.fromName} <${mail.fromEmail}>\nBetreff: ${mail.subject}\n\n${mail.body}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return heuristic(mail);
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") return heuristic(mail);
    return JSON.parse(text.text) as Classification;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Klassifizierung fehlgeschlagen (${error.status}):`, error.message);
    } else {
      console.error("Klassifizierung fehlgeschlagen:", error);
    }
    return heuristic(mail);
  }
}
