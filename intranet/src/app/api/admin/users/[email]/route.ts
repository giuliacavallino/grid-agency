import { withUser } from "@/lib/server/auth";
import { deleteMember, keepsAnAdmin, updateMember, type MemberInput } from "@/lib/server/members";

type Context = { params: Promise<{ email: string }> };

const LAST_ADMIN = Response.json({ error: "Mindestens eine Person muss Admin bleiben" }, { status: 400 });

export const PATCH = withUser(async (_user, request, { params }: Context) => {
  const email = decodeURIComponent((await params).email).toLowerCase();
  const input = (await request.json()) as MemberInput;
  if (!(await keepsAnAdmin(email, input))) return LAST_ADMIN;
  return Response.json(await updateMember(email, input));
}, ["admin"]);

export const DELETE = withUser(async (_user, _request, { params }: Context) => {
  const email = decodeURIComponent((await params).email).toLowerCase();
  if (!(await keepsAnAdmin(email, null))) return LAST_ADMIN;
  await deleteMember(email);
  return new Response(null, { status: 204 });
}, ["admin"]);
