import { withUser } from "@/lib/server/auth";
import { inviteApplication, InviteError } from "@/lib/server/interview";

type Context = { params: Promise<{ id: string }> };

export const maxDuration = 30;

/** Zum Vorstellungsgespräch einladen: Mail von hello@ mit Link zur
 * Terminwahl im Kalender der einladenden Person. */
export const POST = withUser(async (user, _request, { params }: Context) => {
  const { id } = await params;
  try {
    return Response.json(await inviteApplication(id, { email: user.email, name: user.name }));
  } catch (error) {
    if (error instanceof InviteError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}, ["personal"]);
