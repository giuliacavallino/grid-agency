import "server-only";
import { db } from "./db";

type Answer = { label: string; value: string };

/** Formularantworten (Meta Lead Ads, LinkedIn Lead Gen) als Lead anlegen. */
export async function saveAdLead(input: {
  source: "meta" | "instagram" | "linkedin";
  ref: string;
  createdAt?: string;
  answers: Answer[];
  fields: Partial<Record<"name" | "email" | "phone" | "company", string>>;
  context?: string;
  raw: unknown;
}) {
  const { fields, answers } = input;
  const email = fields.email ?? answers.find((a) => /@/.test(a.value))?.value ?? null;
  const message = [
    input.context,
    ...answers.map((a) => `${a.label}: ${a.value}`),
  ]
    .filter(Boolean)
    .join("\n");

  return db().insertIgnore("leads", {
    source: input.source,
    source_ref: input.ref,
    stage: "neu",
    name: fields.name || email || "Unbekannt",
    email,
    phone: fields.phone ?? null,
    company: fields.company ?? null,
    message: message || null,
    ...(input.createdAt ? { created_at: input.createdAt } : {}),
    raw: input.raw,
  });
}
