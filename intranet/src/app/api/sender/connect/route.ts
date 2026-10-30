import { withUser } from "@/lib/server/auth";
import { startConnect } from "@/lib/server/sender";

/** Liefert die Microsoft-Anmeldung für das Absender-Konto */
export const POST = withUser(async (user, request) => {
  const { login_hint } = (await request.json().catch(() => ({}))) as { login_hint?: string };
  const url = await startConnect(new URL(request.url).origin, user.email, login_hint?.trim() || undefined);
  return Response.json({ url });
}, ["admin"]);
