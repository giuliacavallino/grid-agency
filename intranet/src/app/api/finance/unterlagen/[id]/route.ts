import { withUser } from "@/lib/server/auth";
import { BUCKET, check } from "@/lib/server/billing";
import { sb } from "@/lib/server/db";

type Context = { params: Promise<{ id: string }> };

/** 10 Minuten gültiger Link auf ein Dokument der Kundenakte */
export const GET = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  const row = check(await sb().from("customer_documents").select("pdf_path").eq("id", id).maybeSingle()) as { pdf_path: string } | null;
  if (!row) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(row.pdf_path, 600);
  if (error) throw new Error(error.message);
  return Response.json({ url: data.signedUrl });
});
