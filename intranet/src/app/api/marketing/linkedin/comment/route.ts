import { withMarketing } from "@/lib/server/social/auth";
import { commentOnPost } from "@/lib/server/social/community";
import { postUrn } from "@/lib/server/social/linkedin";

/** Beliebigen LinkedIn-Post kommentieren, als Seite oder als Person:
 * { account_id, post: Post-Adresse oder URN, text } */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json().catch(() => ({}))) as { account_id?: string; post?: string; text?: string };
  const urn = body.post ? postUrn(body.post) : null;
  if (!body.account_id || !urn || !body.text?.trim()) return Response.json({ error: "account_id, post (Adresse oder URN) und text nötig" }, { status: 400 });
  try {
    return Response.json(await commentOnPost(body.account_id, urn, body.text), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Kommentieren fehlgeschlagen" }, { status: 400 });
  }
});
