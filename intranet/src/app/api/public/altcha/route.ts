import { createChallenge } from "@/lib/server/altcha";

// Öffentlich: Captcha-Aufgabe für Kontaktformular und Terminbuchung der
// Website (die Website reicht /api/altcha hierher durch).
export function GET() {
  return Response.json(createChallenge(), { headers: { "Cache-Control": "no-store" } });
}
