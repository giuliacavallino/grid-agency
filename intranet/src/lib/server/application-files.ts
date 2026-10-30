import "server-only";
import { DEMO } from "@/lib/config";
import type { ApplicationFile } from "@/lib/sales/types";
import { sb, type Row } from "./db";

/** Bucket für Unterlagen aus dem Bewerbungsformular der Website */
const BUCKET = "bewerbungen";

const filesOf = (application: Row) => (Array.isArray(application.files) ? (application.files as ApplicationFile[]) : []);

export async function downloadApplicationFile(application: Row, index: number) {
  const file = filesOf(application)[index];
  if (!file) return null;
  if (DEMO) return { file, bytes: Buffer.from(`${file.name} (Vorschau)`), contentType: "text/plain; charset=utf-8" };
  const { data, error } = await sb().storage.from(BUCKET).download(file.path);
  if (error) throw new Error(error.message);
  return { file, bytes: Buffer.from(await data.arrayBuffer()), contentType: file.type || "application/octet-stream" };
}

/** Unterlagen einer gelöschten Bewerbung mitlöschen */
export async function removeApplicationFiles(application: Row) {
  const paths = filesOf(application).map((f) => f.path);
  if (DEMO || !paths.length) return;
  const { error } = await sb().storage.from(BUCKET).remove(paths);
  if (error) console.error("Unterlagen nicht gelöscht", error.message);
}
