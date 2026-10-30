import { after } from "next/server";
import { safeEqual } from "@/lib/server/signature";
import { processRecording, recordingReady } from "@/lib/server/meet-recording";

// Azure Event Grid (Communication Services → Ereignisse): meldet fertige
// Aufnahmen. Abo als Webhook auf https://intranet.grid-agency.de/api/webhooks/acs
// mit dem Ereignistyp „Recording File Status Updated“ (Event-Grid-Schema).
// Schlüssel (ACS_EVENTS_SECRET) bevorzugt als Zustellungsattribut im Header
// „X-Grid-Key“ (in Azure als geheim markieren); ?key=… in der URL geht noch,
// steht dann aber im Portal und in Logs. Erst die Schlüsselprüfung, dann der
// Validierungs-Handshake. Doppelte Events sind harmlos: recordingReady()
// übernimmt eine Aufnahme nur einmal.
// Antwort sofort, die Auswertung läuft danach weiter.

export const maxDuration = 300;

type GridEvent = { eventType?: string; subject?: string; data?: Record<string, unknown> };

export async function POST(request: Request) {
  const secret = process.env.ACS_EVENTS_SECRET;
  const key = request.headers.get("x-grid-key") ?? new URL(request.url).searchParams.get("key") ?? "";
  if (!secret || !safeEqual(key, secret)) return Response.json({ error: "Kein Zugriff" }, { status: 401 });

  const events = (await request.json().catch(() => [])) as GridEvent[];
  for (const event of Array.isArray(events) ? events : []) {
    // Bestätigung beim Anlegen des Abos
    if (event.eventType === "Microsoft.EventGrid.SubscriptionValidationEvent") {
      return Response.json({ validationResponse: (event.data as { validationCode?: string })?.validationCode });
    }
    if (event.eventType === "Microsoft.Communication.RecordingFileStatusUpdated") {
      const id = await recordingReady(event);
      if (id) after(() => processRecording(id));
    }
  }
  return Response.json({ ok: true });
}
