import { withMarketing } from "@/lib/server/social/auth";
import { createOutreach, listOutreach, validateOutreach, type OutreachInput } from "@/lib/server/social/community";

/** Outreach-Entwürfe einer Kundenwelt (?workspace=…&status=draft|sent|discarded) */
export const GET = withMarketing(async (_actor, request) => {
  const params = new URL(request.url).searchParams;
  return Response.json(await listOutreach({ workspace_id: params.get("workspace") ?? undefined, status: params.get("status") ?? undefined }));
});

/** Entwurf anlegen: { workspace_id, account_id?, kind: message|invitation, recipient, profile_url, text, context? } */
export const POST = withMarketing(async (actor, request) => {
  const body = (await request.json().catch(() => ({}))) as Partial<OutreachInput>;
  const invalid = validateOutreach(body);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });
  return Response.json(await createOutreach(body as OutreachInput, actor.email), { status: 201 });
});
