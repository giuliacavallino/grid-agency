import { withMarketing } from "@/lib/server/social/auth";
import { listVoices } from "@/lib/server/video/tools";

/** Stimmen aus ElevenLabs (für Voiceover und die Stimme in der CI-Welt) */
export const GET = withMarketing(async () => Response.json(await listVoices()));
