import { after } from "next/server";
import { withUser } from "@/lib/server/auth";
import { sb } from "@/lib/server/db";
import { processRecording } from "@/lib/server/meet-recording";

// Auswertung einer Aufnahme erneut starten, wenn sie fehlgeschlagen ist
// (solange die Datei noch bei Azure liegt).

type Context = { params: Promise<{ id: string }> };

export const maxDuration = 300;

export const POST = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  const { data } = await sb()
    .from("meeting_recordings")
    .update({ status: "verarbeitung", error: null })
    .eq("id", id)
    .eq("status", "fehler")
    .not("chunks", "is", null)
    .select("id")
    .maybeSingle();
  if (!data) return Response.json({ error: "Keine Aufnahmedatei mehr vorhanden" }, { status: 409 });
  after(() => processRecording(id));
  return Response.json({ ok: true });
}, ["aufgaben"]);
