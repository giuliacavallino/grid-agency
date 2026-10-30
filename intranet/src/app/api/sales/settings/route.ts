import { withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

const DEFAULT_CAPACITY = { team_hours_per_month: 480 };
const DEFAULT_DATEV = { upload_address: "" };

export const GET = withUser(async () => {
  const store = db();
  const capacity = (await store.getSetting("capacity")) ?? DEFAULT_CAPACITY;
  const datev = (await store.getSetting("datev")) ?? DEFAULT_DATEV;
  return Response.json({ capacity, datev });
}, ["sales", "finance"]);

/** Im Browser änderbar: Teamkapazität und die DATEV-Upload-Adresse. */
export const PUT = withUser(async (_user, request) => {
  const body = await request.json();
  const store = db();
  const result: Record<string, unknown> = {};

  if (body?.capacity !== undefined) {
    const hours = Number(body.capacity?.team_hours_per_month);
    if (!Number.isFinite(hours) || hours < 0 || hours > 100_000) {
      return Response.json({ error: "Ungültige Kapazität" }, { status: 400 });
    }
    result.capacity = { team_hours_per_month: Math.round(hours) };
    await store.setSetting("capacity", result.capacity);
  }

  if (body?.datev !== undefined) {
    const address = String(body.datev?.upload_address ?? "").trim().toLowerCase();
    if (address && !/^[^\s@]+@uploadmail\.datev\.de$/.test(address)) {
      return Response.json({ error: "Bitte eine Adresse …@uploadmail.datev.de eintragen" }, { status: 400 });
    }
    result.datev = { upload_address: address };
    await store.setSetting("datev", result.datev);
  }

  return Response.json({
    capacity: result.capacity ?? (await store.getSetting("capacity")) ?? DEFAULT_CAPACITY,
    datev: result.datev ?? (await store.getSetting("datev")) ?? DEFAULT_DATEV,
  });
}, ["sales", "finance"]);
