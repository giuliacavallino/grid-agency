import { withUser } from "@/lib/server/auth";
import { listMembers } from "@/lib/server/members";

/** Aktive Teammitglieder (Name, E-Mail) für „Zuständig“ und Profilbilder */
export const GET = withUser(async () =>
  Response.json((await listMembers()).filter((m) => m.active).map(({ email, name }) => ({ email, name })))
);
