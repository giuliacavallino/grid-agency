import { withMarketing } from "@/lib/server/social/auth";
import { createDesign, listDesigns } from "@/lib/server/social/canva";

export const maxDuration = 60;

/** Designs in Canva durchsuchen (?query=…&continuation=…) */
export const GET = withMarketing(async (_actor, request) => {
  const params = new URL(request.url).searchParams;
  return Response.json(await listDesigns(params.get("query") ?? undefined, params.get("continuation") ?? undefined));
});

/** Neues Design anlegen: { title, width?, height?, asset_id?, workspace_id? } (Standard 1080 × 1350) */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json()) as { title?: string; width?: number; height?: number; asset_id?: string; workspace_id?: string };
  if (!body.title?.trim()) return Response.json({ error: "Titel fehlt" }, { status: 400 });
  return Response.json(await createDesign({ ...body, title: body.title }), { status: 201 });
});
