import { DEMO } from "@/lib/config";
import { withUser } from "@/lib/server/auth";
import { createRoom, meetUrl, newCode } from "@/lib/server/meet";

/** GRID-Meet-Raum für einen Termin oder eine Mail anlegen; liefert den Link.
 * Body: { title, start (ISO, optional = jetzt), minutes (optional, 60), record (optional, true) } */
export const POST = withUser(async (user, request) => {
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; start?: unknown; minutes?: unknown; record?: unknown };
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : "Meeting";
  const start = typeof body.start === "string" && !Number.isNaN(Date.parse(body.start)) ? Date.parse(body.start) : Date.now();
  const minutes = typeof body.minutes === "number" && body.minutes > 0 && body.minutes <= 24 * 60 ? Math.round(body.minutes) : 60;
  if (DEMO) {
    const code = newCode();
    return Response.json({ code, url: meetUrl(code) }, { status: 201 });
  }
  const record = body.record !== false;
  return Response.json(await createRoom({ title, start, minutes, host: user.email, hostName: user.name, record }), { status: 201 });
}, ["mail", "sales"]);
