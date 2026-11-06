import { withMarketing } from "@/lib/server/social/auth";
import { planFromContract } from "@/lib/server/social/posting-plan";

export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

/** Vertrag (PDF, Feld „file“) lesen: liefert den vorgeschlagenen Plan, speichert nichts */
export const POST = withMarketing(
  async (_actor, request, { params }: Context) => {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf") return Response.json({ error: "Bitte den Vertrag als PDF hochladen" }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return Response.json({ error: "PDF ist zu groß (max. 20 MB)" }, { status: 400 });
    try {
      return Response.json(await planFromContract((await params).id, new Uint8Array(await file.arrayBuffer()), file.name));
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 400 });
    }
  },
  { agent: false }
);
