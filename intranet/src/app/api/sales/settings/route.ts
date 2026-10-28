import { withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

const DEFAULT_CAPACITY = { team_hours_per_month: 480 };

export const GET = withUser(async () => {
  const capacity = (await db().getSetting("capacity")) ?? DEFAULT_CAPACITY;
  return Response.json({ capacity });
});

/** Nur die Teamkapazität ist im Browser änderbar. */
export const PUT = withUser(async (_user, request) => {
  const body = await request.json();
  const hours = Number(body?.capacity?.team_hours_per_month);
  if (!Number.isFinite(hours) || hours < 0 || hours > 100_000) {
    return Response.json({ error: "Ungültige Kapazität" }, { status: 400 });
  }
  const capacity = { team_hours_per_month: Math.round(hours) };
  await db().setSetting("capacity", capacity);
  return Response.json({ capacity });
});
