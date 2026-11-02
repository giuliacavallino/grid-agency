import { refreshAvatars } from "@/lib/server/avatars";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 300;

/** Wöchentlich: Profilbilder der Kunden aus Instagram auffrischen (vercel.json) */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  return Response.json({ refreshed: await refreshAvatars() });
}
