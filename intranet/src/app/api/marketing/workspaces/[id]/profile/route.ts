import { PROFILE_PROVIDERS, type PostProvider } from "@/lib/marketing";
import { withMarketing } from "@/lib/server/social/auth";
import { channelProfile } from "@/lib/server/social/profile";
import { getWorkspace } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };

/** Aktuelles Profil eines Kanals: ?provider=instagram|tiktok|facebook|linkedin.
 * Mit Verbindung live von der Plattform, sonst nur der hinterlegte Link. */
export const GET = withMarketing(async (_actor, request, { params }: Context) => {
  const { id } = await params;
  const provider = new URL(request.url).searchParams.get("provider") as PostProvider | null;
  if (!provider || !PROFILE_PROVIDERS.includes(provider)) return Response.json({ error: "Unbekannte Plattform" }, { status: 400 });
  const workspace = await getWorkspace(id);
  if (!workspace) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  return Response.json(await channelProfile(workspace, provider), { headers: { "Cache-Control": "no-store" } });
});
