import "server-only";
import { withUser } from "../auth";
import { safeEqual } from "../signature";

// Zugriff auf den Marketing Hub: entweder angemeldete Personen mit dem
// Bereich „marketing“ oder der Agent mit AGENT_API_KEY (Bearer). Der Agent
// arbeitet damit eigenständig: Designs in Canva, Medien, Posts planen und
// veröffentlichen. Verbinden von Kanälen bleibt Menschen vorbehalten.

export type Actor = { kind: "user" | "agent"; email: string };

function isAgent(request: Request) {
  const key = process.env.AGENT_API_KEY;
  const header = request.headers.get("authorization") ?? "";
  return !!key && key.length >= 32 && safeEqual(header, `Bearer ${key}`);
}

export function withMarketing<Args extends unknown[]>(
  handler: (actor: Actor, request: Request, ...args: Args) => Promise<Response>,
  options: { agent?: boolean } = { agent: true }
) {
  const asUser = withUser<Args>((user, request, ...args) => handler({ kind: "user", email: user.email }, request, ...args), ["marketing"]);
  return async (request: Request, ...args: Args) => {
    if (options.agent !== false && isAgent(request)) {
      try {
        return await handler({ kind: "agent", email: "agent" }, request, ...args);
      } catch (error) {
        console.error(error);
        return Response.json({ error: error instanceof Error ? error.message : "Serverfehler" }, { status: 500 });
      }
    }
    return asUser(request, ...args);
  };
}
