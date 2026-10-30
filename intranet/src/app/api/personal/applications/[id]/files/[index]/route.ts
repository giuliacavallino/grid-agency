import { withUser } from "@/lib/server/auth";
import { downloadApplicationFile } from "@/lib/server/application-files";
import { db } from "@/lib/server/db";

type Context = { params: Promise<{ id: string; index: string }> };

/** Hochgeladene Unterlage einer Bewerbung (Website-Formular) */
export const GET = withUser(async (_user, _request, { params }: Context) => {
  const { id, index } = await params;
  const application = await db().get("applications", id);
  if (!application) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  const result = await downloadApplicationFile(application, Number(index));
  if (!result) return Response.json({ error: "Keine Datei" }, { status: 404 });
  return new Response(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.file.name)}`,
      "Cache-Control": "private, max-age=3600",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}, ["personal"]);
