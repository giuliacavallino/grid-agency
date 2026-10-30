"use server";

import { intranet } from "@/lib/intranet";

export type EbookFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/** Kampagnen-Parameter, die das Formular aus der URL mitschickt. */
const TRACKING_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
] as const;

/** E-Book-Anforderung von /ebook: Das Intranet prüft das Captcha, legt den
 * Lead in Sales → Pipeline an und schickt das PDF von hello@. Mit dem
 * Absenden stimmt die Person dem Versand und der Kontaktaufnahme zu (Text
 * unter dem Button). */
export async function requestEbook(
  _prevState: EbookFormState,
  formData: FormData
): Promise<EbookFormState> {
  // Honeypot: nur Bots füllen das versteckte Feld aus
  if (String(formData.get("website") ?? "")) return { status: "success" };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();

  if (!name || !email) {
    return { status: "error", message: "Bitte gib deinen Namen und deine E-Mail-Adresse ein." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }

  const tracking: Record<string, string> = {};
  for (const field of TRACKING_FIELDS) {
    const value = String(formData.get(field) ?? "").trim().slice(0, 200);
    if (value) tracking[field] = value;
  }

  try {
    await intranet("/api/public/ebook", {
      method: "POST",
      body: JSON.stringify({ name, email, company, tracking, altcha: String(formData.get("altcha") ?? "") }),
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Da ist etwas schiefgelaufen. Bitte versuch es später erneut.",
    };
  }

  return { status: "success" };
}
