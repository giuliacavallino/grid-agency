"use server";

import { jobs } from "@/lib/content";
import { APPLICATION_MAX_BYTES, APPLICATION_MAX_FILES } from "@/lib/application";
import { getSupabase } from "@/lib/supabase";

export type ApplicationFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/** Erlaubte Unterlagen, Typ nach Dateiendung (Browser liefern den MIME-Typ
 * nicht zuverlässig, z. B. bei Word-Dateien). */
const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const failed: ApplicationFormState = {
  status: "error",
  message: "Da ist etwas schiefgelaufen. Bitte versuch es später erneut.",
};

/** Dateiname für den Speicherpfad: ohne Umlaute, Leer- und Sonderzeichen. */
function safeName(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .slice(-80) || "datei"
  );
}

/** Bewerbung von /jobs: Unterlagen in den privaten Bucket „bewerbungen“,
 * die Bewerbung selbst als Karte in Personal → Bewerbungen im Intranet. */
export async function submitApplication(
  _prevState: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  // Honeypot: nur Bots füllen das versteckte Feld aus
  if (String(formData.get("website") ?? "")) return { status: "success" };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const job = String(formData.get("job") ?? "");
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!name || !email || !job) {
    return { status: "error", message: "Bitte fülle alle Pflichtfelder aus." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }
  if (!files.length) {
    return { status: "error", message: "Bitte lade deinen Lebenslauf hoch." };
  }
  if (files.length > APPLICATION_MAX_FILES) {
    return { status: "error", message: `Bitte lade höchstens ${APPLICATION_MAX_FILES} Dateien hoch.` };
  }
  if (files.reduce((sum, f) => sum + f.size, 0) > APPLICATION_MAX_BYTES) {
    return { status: "error", message: "Deine Unterlagen sind zusammen größer als 4 MB." };
  }
  const types = files.map((f) => FILE_TYPES[f.name.split(".").pop()?.toLowerCase() ?? ""]);
  if (types.some((t) => !t)) {
    return { status: "error", message: "Bitte lade PDF-, JPG-, PNG- oder Word-Dateien hoch." };
  }

  const supabase = getSupabase();
  if (!supabase) return failed;

  const id = crypto.randomUUID();
  const uploaded: { path: string; name: string; type: string; size: number }[] = [];
  for (const [i, file] of files.entries()) {
    const path = `${id}/${i}-${safeName(file.name)}`;
    const { error } = await supabase.storage
      .from("bewerbungen")
      .upload(path, file, { contentType: types[i], upsert: false });
    if (error) return failed;
    uploaded.push({ path, name: file.name, type: types[i], size: file.size });
  }

  const { error } = await supabase.rpc("submit_application", {
    p_id: id,
    p_name: name,
    p_email: email,
    p_phone: phone || null,
    p_job_slug: jobs.some((j) => j.slug === job) ? job : null,
    p_link: link || null,
    p_message: message || null,
    p_files: uploaded,
  });
  if (error) return failed;

  return {
    status: "success",
    message: "Danke für deine Bewerbung! Wir schauen sie uns an und melden uns bei dir.",
  };
}
