import { withUser } from "@/lib/server/auth";

/** Eigene Rechte für die Oberfläche (Bereiche ein-/ausblenden). Geprüft wird
 * trotzdem in jeder API-Route. */
export const GET = withUser(async (user) => Response.json(user.member));
