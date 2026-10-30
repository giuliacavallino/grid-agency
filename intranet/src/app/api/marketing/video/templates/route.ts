import { withMarketing } from "@/lib/server/social/auth";
import { listTemplates } from "@/lib/server/video/tools";

/** Vorlagen aus Creatomate (Motion Design, Reels, Untertitel-Layouts) */
export const GET = withMarketing(async () => Response.json(await listTemplates()));
