import { CaptchaError } from "@/lib/server/altcha";
import { FlowError, requestEbook } from "@/lib/server/lead-flow";

// Öffentlich: E-Book-Anforderung von der Website /ebook (serverseitig
// aufgerufen), nur mit gelöstem Captcha. Legt den Lead an und schickt das
// PDF von hello@.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const tracking =
    body.tracking && typeof body.tracking === "object"
      ? Object.fromEntries(Object.entries(body.tracking as Record<string, unknown>).map(([key, value]) => [key, text(value)]))
      : {};
  try {
    await requestEbook({
      name: text(body.name),
      email: text(body.email),
      company: text(body.company),
      tracking,
      altcha: text(body.altcha),
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof FlowError || error instanceof CaptchaError) return Response.json({ error: error.message }, { status: 400 });
    console.error(error);
    return Response.json({ error: "Da ist etwas schiefgelaufen. Bitte versuch es später erneut." }, { status: 500 });
  }
}
