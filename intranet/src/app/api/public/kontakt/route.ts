import { CaptchaError } from "@/lib/server/altcha";
import { contact, FlowError } from "@/lib/server/lead-flow";

// Öffentlich: Kontaktformular der Website (serverseitig aufgerufen), nur mit
// gelöstem Captcha. Der Lead entsteht per Trigger aus contact_submissions.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  try {
    await contact({
      name: text(body.name),
      email: text(body.email),
      company: text(body.company),
      budget: text(body.budget),
      message: text(body.message),
      altcha: text(body.altcha),
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof FlowError || error instanceof CaptchaError) return Response.json({ error: error.message }, { status: 400 });
    console.error(error);
    return Response.json({ error: "Da ist etwas schiefgelaufen. Bitte versuch es später erneut." }, { status: 500 });
  }
}
