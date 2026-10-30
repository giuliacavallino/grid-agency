import { vaultStatus } from "@/lib/server/vault";
import { withMarketing } from "@/lib/server/social/auth";
import { canvaAccount } from "@/lib/server/social/canva";
import { configured, ENV_NAMES } from "@/lib/server/social/connect";
import { publicAccount } from "@/lib/server/social/store";
import { TOOL_ENV, toolsConfigured } from "@/lib/server/video/tools";

/** Was eingerichtet ist (nur ob, nie Werte) und ob Canva verbunden ist */
export const GET = withMarketing(async () => {
  const canva = await canvaAccount();
  return Response.json({
    configured: configured(),
    env: ENV_NAMES,
    vault: vaultStatus() === "ok",
    agent: (process.env.AGENT_API_KEY?.length ?? 0) >= 32,
    canva: canva ? publicAccount(canva) : null,
    tools: toolsConfigured(),
    tool_env: TOOL_ENV,
  });
});
