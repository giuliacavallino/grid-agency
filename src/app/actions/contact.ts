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
  const field = (key: string) => String(formData.get(key) ?? "").trim();
  const name = field("name");
  const email = field("email");
  const message = field("message");

  if (!name || !email || !message) {
    return { status: "error", message: "Bitte fülle alle Pflichtfelder aus." };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { status: "error", message: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }

  // Das Intranet prüft das Captcha und legt die Anfrage als Lead an.
  try {
    await intranet("/api/public/kontakt", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        company: field("company"),
        budget: field("budget"),
        message,
        altcha: field("altcha"),
      }),
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Da ist etwas schiefgelaufen. Bitte versuch es später erneut.",
    };
  }

  return { status: "success", message: "Danke! Wir melden uns in Kürze bei dir." };
}
