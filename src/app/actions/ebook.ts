"use server";

import { getSupabase } from "@/lib/supabase";

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

const META_SOURCES = ["facebook", "fb", "instagram", "ig", "meta"];

/** E-Book-Anforderung von /ebook: wird über submit_ebook_lead() direkt als
 * Lead in Sales → Pipeline im Intranet angelegt. */
export async function requestEbook(
  _prevState: EbookFormState,
  formData: FormData
): Promise<EbookFormState> {
  // Honeypot: nur Bots füllen das versteckte Feld aus
  if (String(formData.get("website") ?? "")) return { status: "success" };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const consent = formData.get("consent") === "on";

  if (!name || !email) {
    return { status: "error", message: "Bitte gib deinen Namen und deine E-Mail-Adresse ein." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }
  if (!consent) {
    return { status: "error", message: "Bitte bestätige die Einwilligung, um das E-Book zu erhalten." };
  }

  const tracking: Record<string, string> = {};
  for (const field of TRACKING_FIELDS) {
    const value = String(formData.get(field) ?? "").trim().slice(0, 200);
    if (value) tracking[field] = value;
  }
  const fromMeta =
    Boolean(tracking.fbclid) ||
    META_SOURCES.includes((tracking.utm_source ?? "").toLowerCase());

  const supabase = getSupabase();
  if (!supabase) {
    return {
      status: "error",
      message: "Da ist etwas schiefgelaufen. Bitte versuch es später erneut.",
    };
  }

  const { error } = await supabase.rpc("submit_ebook_lead", {
    p_name: name,
    p_email: email,
    p_company: company || null,
    p_from_meta: fromMeta,
    p_tracking: tracking,
  });
  if (error) {
    return {
      status: "error",
      message: "Da ist etwas schiefgelaufen. Bitte versuch es später erneut.",
    };
  }

  return { status: "success" };
}
