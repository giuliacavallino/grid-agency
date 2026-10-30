import { withUser } from "@/lib/server/auth";
import { getVisible, listLog } from "@/lib/server/vault";

/** Zugriffsprotokoll: alles nur für die Geschäftsführung, je Eintrag für alle,
 * die den Eintrag sehen dürfen. */
export const GET = withUser(async (user, request) => {
  const item = new URL(request.url).searchParams.get("item");
  if (item) {
    if (!(await getVisible(user, item))) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
    return Response.json(await listLog(item));
  }
  if (!user.admin) return Response.json({ error: "Nur für die Geschäftsführung" }, { status: 403 });
  return Response.json(await listLog());
});
