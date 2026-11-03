import type { PostProvider } from "@/lib/marketing";
import { withMarketing } from "@/lib/server/social/auth";
import { getWorkspace, updateProfiles } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };

/** Profil-Links hinterlegen: { instagram?, tiktok?, facebook?, linkedin? }
 * als Link oder Name (@name); leer oder null entfernt den Link. */
export const PATCH = withMarketing(async (_actor, request, { params }: Context) => {
  const { id } = await params;
  if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as Partial<Record<PostProvider, string | null>> | null;
  if (!body || typeof body !== "object") return Response.json({ error: "Ungültige Eingabe" }, { status: 400 });
  try {
    return Response.json({ profiles: await updateProfiles(id, body) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" }, { status: 400 });
  }
});
