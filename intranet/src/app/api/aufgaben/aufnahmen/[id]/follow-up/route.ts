import { withUser } from "@/lib/server/auth";
import { writeFollowUp } from "@/lib/server/meet-recording";

// Follow-up-Mail zu einem ausgewerteten Call (neu) schreiben

type Context = { params: Promise<{ id: string }> };

export const maxDuration = 120;

export const POST = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  try {
    return Response.json(await writeFollowUp(id));
  } catch (error) {
    console.error(error);
    return Response.json({ error: (error as Error).message.slice(0, 300) }, { status: 400 });
  }
}, ["aufgaben"]);
