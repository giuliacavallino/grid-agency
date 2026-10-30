import { withMarketing } from "@/lib/server/social/auth";
import { suggestBrand } from "@/lib/server/social/brand";

type Context = { params: Promise<{ id: string }> };

export const maxDuration = 120;

/** Entwurf der CI-Welt von Claude (aus Briefing, Website und Eingetragenem); speichert nichts */
export const POST = withMarketing(
  async (_actor, _request, { params }: Context) => {
    const { id } = await params;
    try {
      return Response.json(await suggestBrand(id));
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Vorschlag fehlgeschlagen" }, { status: 400 });
    }
  },
  { agent: false }
);
