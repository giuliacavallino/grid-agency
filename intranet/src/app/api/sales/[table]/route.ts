import { withUser } from "@/lib/server/auth";
import { db, isTable, pick, TABLES } from "@/lib/server/db";

type Context = { params: Promise<{ table: string }> };

/** Liste einer Sales-Tabelle. Erlaubte Filter kommen als Query-Parameter,
 * ?ids=a,b holt gezielt einzelne Zeilen. */
export const GET = withUser(async (_user, request, { params }: Context) => {
  const { table } = await params;
  if (!isTable(table)) return Response.json({ error: "Unbekannt" }, { status: 404 });

  const search = new URL(request.url).searchParams;
  const filters: Record<string, string> = {};
  for (const key of TABLES[table].filters) {
    const value = search.get(key);
    if (value !== null) filters[key] = value;
  }
  const ids = search.get("ids")?.split(",").filter(Boolean);
  return Response.json(await db().list(table, filters, ids));
});

export const POST = withUser(async (user, request, { params }: Context) => {
  const { table } = await params;
  if (!isTable(table) || table === "inbound_messages") {
    return Response.json({ error: "Unbekannt" }, { status: 404 });
  }
  const row = pick(table, await request.json());
  if (table === "lead_activities") row.author = user.name;
  if (table === "leads" && !row.owner) row.owner = user.email;
  return Response.json(await db().insert(table, row), { status: 201 });
});
