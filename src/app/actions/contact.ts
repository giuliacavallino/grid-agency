"use server";

import { intranet } from "@/lib/intranet";

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  // Honeypot: nur Bots füllen das versteckte Feld aus
  if (String(formData.get("website") ?? "")) return { status: "success" };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const budget = String(formData.get("budget") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name || !email || !phone || !message) {
    return { status: "error", message: "Bitte fülle alle Pflichtfelder aus." };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { status: "error", message: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }

  // Mindestens 6 Ziffern, sonst nur Leerzeichen, +, -, /, Klammern.
  if (!/^\+?[0-9 ()/-]{6,30}$/.test(phone) || phone.replace(/\D/g, "").length < 6) {
    return { status: "error", message: "Bitte gib eine gültige Handynummer ein." };
  }

  // Das Intranet prüft das Captcha und legt die Anfrage als Lead an.
  try {
    await intranet("/api/public/kontakt", {
      method: "POST",
      body: JSON.stringify({ name, email, phone, company, budget, message, altcha: String(formData.get("altcha") ?? "") }),
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Da ist etwas schiefgelaufen. Bitte versuch es später erneut.",
    };
  }

  return { status: "success", message: "Danke! Deine Nachricht ist bei uns, wir melden uns innerhalb von zwei Werktagen." };
}
