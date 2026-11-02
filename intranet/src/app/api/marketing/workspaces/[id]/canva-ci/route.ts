import { withMarketing } from "@/lib/server/social/auth";
import { importCiFromCanva } from "@/lib/server/social/canva-ci";

export const maxDuration = 180;

type Context = { params: Promise<{ id: string }> };

/** Logo und CI aus dem Canva-Design „CI – <Kunde>“ übernehmen; nur das Team */
export const POST = withMarketing(
  async (_actor, _request, { params }: Context) => {
    const { id } = await params;
    return Response.json(await importCiFromCanva(id));
  },
  { agent: false }
);
