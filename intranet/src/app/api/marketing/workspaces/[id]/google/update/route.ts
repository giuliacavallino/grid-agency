import { withMarketing } from "@/lib/server/social/auth";
import { getWorkspace } from "@/lib/server/social/store";
import { draftUpdate, googleFail, logUpdate, saveUpdateSettings } from "@/lib/server/google";

type Context = { params: Promise<{ id: string }> };

const emails = (value: unknown) => (Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(/[,;\s]+/) : []).map((v) => v.trim()).filter(Boolean);

/** Vorschlag fürs Wochen-Update: { settings, history, subject, html } */
export const GET = withMarketing(async (_actor, _request, { params }: Context) => {
  const { id } = await params;
  if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  return Response.json(await draftUpdate(id), { headers: { "Cache-Control": "no-store" } });
});

/** Empfänger, Anrede, Postfach, Montags-Entwurf speichern */
export const PUT = withMarketing(
  async (_actor, request, { params }: Context) => {
    const { id } = await params;
    if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      const patch = {
        ...("to" in body ? { to: emails(body.to) } : {}),
        ...("cc" in body ? { cc: emails(body.cc) } : {}),
        ...(typeof body.greeting === "string" ? { greeting: body.greeting } : {}),
        ...(typeof body.mailbox === "string" ? { mailbox: body.mailbox } : {}),
        ...(typeof body.auto_draft === "boolean" ? { auto_draft: body.auto_draft } : {}),
        ...(typeof body.reviews === "boolean" ? { reviews: body.reviews } : {}),
      };
      await saveUpdateSettings(id, patch);
      return Response.json(await draftUpdate(id));
    } catch (error) {
      return googleFail(error);
    }
  },
  { agent: false }
);

/** Im Browser gesendet oder als Entwurf gespeichert: protokollieren */
export const POST = withMarketing(
  async (actor, request, { params }: Context) => {
    const { id } = await params;
    if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const status = body.status === "sent" ? "sent" : body.status === "draft" ? "draft" : null;
    if (!status || typeof body.subject !== "string" || typeof body.html !== "string") return Response.json({ error: "status, subject und html fehlen" }, { status: 400 });
    const history = await logUpdate(id, {
      status,
      subject: body.subject.slice(0, 300),
      to: emails(body.to),
      cc: emails(body.cc),
      html: body.html.slice(0, 200_000),
      mailbox: typeof body.mailbox === "string" ? body.mailbox : null,
      sent_by: actor.email,
    });
    return Response.json(history);
  },
  { agent: false }
);
