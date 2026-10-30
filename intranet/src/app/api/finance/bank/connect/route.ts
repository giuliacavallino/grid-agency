import { withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { banks, BankError, startAuth } from "@/lib/server/enable-banking";

/** Freigabe bei der Bank starten. Die Rückleitung (callback) muss in der
 * Enable-Banking-App als Redirect-URL eingetragen sein. */
export const POST = withUser(async (user, request) => {
  const body = await request.json().catch(() => ({}));
  const psuType = body?.psu_type === "personal" ? "personal" : "business";
  try {
    const aspsp = (await banks()).find((b) => b.name === body?.aspsp);
    if (!aspsp) return Response.json({ error: "Bank nicht gefunden" }, { status: 400 });
    const redirectUrl = `${new URL(request.url).origin}/api/finance/bank/callback`;
    const { url, state } = await startAuth(aspsp, psuType, redirectUrl);
    await db().setSetting("bank_auth", { state, by: user.name, at: new Date().toISOString() });
    return Response.json({ url });
  } catch (error) {
    if (error instanceof BankError) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
}, ["finance"]);
