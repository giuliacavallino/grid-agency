"use client";

import { Check, X } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { PageBar } from "@/components/sales/shell";
import { Spinner } from "@/components/ui";
import { useMarketingStatus } from "./common";

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/api/marketing/workspaces", "Kundenwelten mit verbundenen Kanälen (IDs für Posts)"],
  ["GET", "/api/marketing/workspaces/{id}/brand", "CI-Welt des Kunden + fertige Vorgabe (brief): vor jedem Design/Post lesen"],
  ["GET", "/api/marketing/canva/designs?query=…", "Designs in Canva suchen"],
  ["POST", "/api/marketing/canva/designs", "Design anlegen { title, width?, height?, asset_id?, workspace_id? }"],
  ["POST", "/api/marketing/canva/assets", "Bild/Video nach Canva hochladen (multipart „file“ oder { url })"],
  ["POST", "/api/marketing/canva/export", "Design exportieren { design_id, format: png|jpg|mp4|pdf } → media"],
  ["POST", "/api/marketing/media", "Eigene Datei ablegen ({ url } oder multipart bis 4 MB) → media"],
  ["POST", "/api/marketing/media/upload-url", "Große Datei: { name, mime } → upload_url (PUT) + media"],
  ["GET", "/api/marketing/posts?workspace=…", "Posts einer Kundenwelt"],
  ["POST", "/api/marketing/posts", "Post { workspace_id, caption, media, account_ids, scheduled_at? | publish_now? }"],
  ["PATCH", "/api/marketing/posts/{id}", "Ändern, planen (status: scheduled) oder zurück in den Entwurf"],
  ["GET", "/api/marketing/video/templates", "Creatomate-Vorlagen (Motion Design, Reels)"],
  ["POST", "/api/marketing/video/render", "Video rendern { template_id, modifications } oder { source } (Schnitt) → id"],
  ["GET", "/api/marketing/video/render/{id}?store=1", "Status; fertig → media zum Posten"],
  ["POST", "/api/marketing/video/transcribe", "Untertitel/Transkript { path, format: srt|vtt|text } (Whisper)"],
  ["GET", "/api/marketing/video/voices", "ElevenLabs-Stimmen"],
  ["POST", "/api/marketing/video/voiceover", "Voiceover (MP3) { text, voice_id?, workspace_id? }"],
  ["POST", "/api/marketing/video/music", "Musik (MP3) { prompt, seconds? }"],
  ["POST", "/api/marketing/posts/{id}/publish", "Sofort veröffentlichen / fehlgeschlagene Kanäle erneut"],
];

/** Marketing → Agent & API: womit der Agent eigenständig arbeitet */
export function AgentApi() {
  const status = useMarketingStatus();
  if (!status.data) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const checks: [boolean, string][] = [
    [status.data.agent, "AGENT_API_KEY in Vercel (mind. 32 Zeichen)"],
    [status.data.vault, "VAULT_KEY (Zugänge verschlüsselt)"],
    [!!status.data.canva, "Canva verbunden"],
    [status.data.configured.meta, "Meta-App (META_APP_ID / META_APP_SECRET)"],
    [status.data.configured.linkedin, "LinkedIn Community Management (LINKEDIN_CM_CLIENT_ID / _SECRET)"],
    [status.data.configured.tiktok, "TikTok (TIKTOK_CLIENT_KEY / _SECRET)"],
    [status.data.tools.creatomate, "Creatomate: Rendern, Schnitt, Motion Design (CREATOMATE_API_KEY)"],
    [status.data.tools.whisper, "Whisper: Untertitel und Transkripte (OPENAI_API_KEY)"],
    [status.data.tools.elevenlabs, "ElevenLabs: Voiceover und Musik (ELEVENLABS_API_KEY)"],
  ];
  return (
    <div className="flex h-full flex-col">
      <PageBar title="Agent & API" meta="Schnittstelle für den Marketing-Agenten" />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-10 md:px-6">
        <div className="max-w-3xl space-y-6">
          <p className="text-[13.5px] leading-relaxed text-snow/70">
            Der Agent arbeitet über dieselbe Schnittstelle wie das Team: Kundenwelt wählen, Design in Canva anlegen oder exportieren, Post mit Text,
            Medien und Kanälen anlegen und sofort oder zu einem Zeitpunkt veröffentlichen. Er meldet sich mit{" "}
            <code className="rounded bg-snow/[0.08] px-1">Authorization: Bearer AGENT_API_KEY</code> an. Kanäle verbinden oder trennen kann nur das Team.
            Ausführlich: <code className="rounded bg-snow/[0.08] px-1">intranet/docs/marketing-hub.md</code>.
          </p>
          <ul className="space-y-1.5">
            {checks.map(([ok, label]) => (
              <li key={label} className={clsx("flex items-center gap-2 text-[13.5px]", ok ? "text-snow/80" : "text-snow/55")}>
                {ok ? <Check className="h-4 w-4 text-[#30a46c]" /> : <X className="h-4 w-4 text-error" />}
                {label}
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto rounded-2xl border border-snow/[0.08]">
            <table className="w-full text-left text-[13px]">
              <tbody>
                {ENDPOINTS.map(([method, path, text]) => (
                  <tr key={`${method} ${path}`} className="border-b border-snow/[0.06] last:border-0">
                    <td className="px-3 py-2 align-top font-mono text-[12px] text-snow/60">{method}</td>
                    <td className="px-3 py-2 align-top font-mono text-[12px] whitespace-nowrap">{path}</td>
                    <td className="px-3 py-2 align-top text-snow/70">{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
