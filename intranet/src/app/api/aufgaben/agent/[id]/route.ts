import { after } from "next/server";
import { withUser } from "@/lib/server/auth";
import { handToAgent, runTask, stopAgent } from "@/lib/server/agent/runner";

// Agent arbeitet bis zu einige Minuten (Recherche, Grafiken, Videos)
export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

/** Aufgabe an den Agenten übergeben; er legt sofort los */
export const POST = withUser(async (user, _request, { params }: Context) => {
  const { id } = await params;
  const task = await handToAgent(id, user.name);
  after(() => runTask(id).catch((error) => console.error("Agent", error)));
  return Response.json(task);
}, ["aufgaben"]);

/** Übergabe zurücknehmen */
export const DELETE = withUser(async (user, _request, { params }: Context) => {
  const { id } = await params;
  return Response.json(await stopAgent(id, user.name));
}, ["aufgaben"]);
