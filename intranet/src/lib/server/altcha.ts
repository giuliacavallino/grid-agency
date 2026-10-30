import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { DEMO } from "@/lib/config";
import { sb } from "./db";

// Captcha für Kontaktformular und Terminbuchung (ALTCHA, Proof of Work):
// Der Browser sucht eine Zahl, deren SHA-256 mit dem Salz die Aufgabe
// ergibt – für Menschen unsichtbar, für Spam-Bots teuer. Keine Cookies,
// kein Drittanbieter. Aufgaben sind signiert, laufen nach 10 Minuten ab und
// gelten nur einmal (altcha_used).

export class CaptchaError extends Error {}

const MAX_NUMBER = 150_000;
const TTL_SECONDS = 600;

const sha256 = (data: string) => createHash("sha256").update(data).digest("hex");

/** Schlüssel: eigener Wert oder aus dem Service-Key abgeleitet (verlässt den Server nie) */
function key() {
  const own = process.env.ALTCHA_HMAC_KEY;
  if (own) return own;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY ?? (DEMO ? "vorschau" : "");
  if (!base) throw new Error("ALTCHA-Schlüssel fehlt");
  return sha256(`altcha|${base}`);
}

const sign = (challenge: string) => createHmac("sha256", key()).update(challenge).digest("hex");

export function createChallenge() {
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const salt = `${randomBytes(12).toString("hex")}?expires=${expires}`;
  const challenge = sha256(`${salt}${randomInt(MAX_NUMBER)}`);
  return { algorithm: "SHA-256", challenge, maxnumber: MAX_NUMBER, salt, signature: sign(challenge) };
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Prüft die Lösung aus dem Formularfeld „altcha“ (Base64-JSON) */
export async function verifyAltcha(payload: string | null | undefined) {
  if (!payload) throw new CaptchaError("Bitte bestätige kurz, dass du kein Roboter bist.");
  let data: { algorithm?: string; challenge?: string; number?: number; salt?: string; signature?: string };
  try {
    data = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    throw new CaptchaError("Captcha ungültig. Bitte lade die Seite neu.");
  }
  const { algorithm, challenge, number, salt, signature } = data;
  if (algorithm !== "SHA-256" || !challenge || !salt || !signature || typeof number !== "number") throw new CaptchaError("Captcha ungültig.");
  const expires = Number(new URLSearchParams(salt.split("?")[1] ?? "").get("expires"));
  if (!expires || expires * 1000 < Date.now()) throw new CaptchaError("Das Captcha ist abgelaufen. Bitte noch einmal absenden.");
  if (!same(sha256(`${salt}${number}`), challenge) || !same(sign(challenge), signature)) throw new CaptchaError("Captcha ungültig.");
  if (DEMO) return;
  // Jede Lösung nur einmal
  const { error } = await sb().from("altcha_used").insert({ signature, expires_at: new Date(expires * 1000).toISOString() });
  if (error) throw new CaptchaError("Dieses Captcha wurde schon benutzt. Bitte lade die Seite neu.");
  await sb().from("altcha_used").delete().lt("expires_at", new Date().toISOString());
}
