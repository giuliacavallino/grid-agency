import { withUser } from "@/lib/server/auth";
import { createMember, listMembers, type MemberInput } from "@/lib/server/members";

export const GET = withUser(async () => Response.json(await listMembers()), ["admin"]);

/** Microsoft-Konto für das Intranet freischalten */
export const POST = withUser(async (_user, request) => {
  const { email, ...input } = (await request.json()) as MemberInput & { email: string };
  try {
    return Response.json(await createMember(String(email ?? ""), input), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 400 });
  }
}, ["admin"]);
