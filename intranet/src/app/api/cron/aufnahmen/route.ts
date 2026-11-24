import { after } from "next/server";
import { processRecording, staleRecordings } from "@/lib/server/meet-recording";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 300;

/** Alle 5 Minuten (vercel.json): Calls, zu denen seit 5 Minuten kein Ton mehr
 * kam (Tab zu, Verbindung weg), abschließen und auswerten. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Nicht erlaubt", { status: 401 });
  const ids = await staleRecordings();
  if (ids.length) after(async () => {
    for (const id of ids) await processRecording(id);
  });
  return Response.json({ processing: ids });
}
