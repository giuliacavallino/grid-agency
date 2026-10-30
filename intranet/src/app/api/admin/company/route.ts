import { EMPTY_COMPANY, type Company } from "@/lib/access";
import { withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

/** Firmendaten (Admin → Firmendaten); lesen dürfen alle, z. B. für Rechnungen
 * oder Signaturen, ändern nur Admins. */
export const GET = withUser(async () => Response.json({ ...EMPTY_COMPANY, ...((await db().getSetting<Company>("company")) ?? {}) }));

export const PUT = withUser(async (_user, request) => {
  const body = (await request.json()) as Partial<Company>;
  const current = { ...EMPTY_COMPANY, ...((await db().getSetting<Company>("company")) ?? {}) };
  const next = { ...current };
  for (const key of Object.keys(EMPTY_COMPANY) as (keyof Company)[]) {
    if (typeof body[key] === "string") next[key] = body[key].trim().slice(0, 500);
  }
  await db().setSetting("company", next);
  return Response.json(next);
}, ["admin"]);
