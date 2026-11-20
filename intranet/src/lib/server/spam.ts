import "server-only";
import { DEMO, DOMAIN } from "@/lib/config";
import { sb } from "./db";

/** Ist die Adresse als Spam gesperrt (Knopf „Spam“ in der Pipeline)? */
export async function isSpamSender(email: string | null | undefined) {
  const address = (email ?? "").trim().toLowerCase();
  if (DEMO || !address || address.endsWith(`@${DOMAIN}`)) return false;
  const { data } = await sb().from("spam_senders").select("email").eq("email", address).maybeSingle();
  return !!data;
}
