"use server";

import { supabase } from "@/lib/supabase";

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const budget = String(formData.get("budget") ?? "").trim();

  if (!name || !email || !message) {
    return { status: "error", message: "Bitte fülle alle Pflichtfelder aus." };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { status: "error", message: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }

  const { error } = await supabase.from("contact_submissions").insert({
    name,
    email,
    company: company || null,
    message,
    budget: budget || null,
  });

  if (error) {
    return {
      status: "error",
      message: "Da ist etwas schiefgelaufen. Bitte versuch es später erneut.",
    };
  }

  return { status: "success", message: "Danke! Wir melden uns in Kürze bei dir." };
}
