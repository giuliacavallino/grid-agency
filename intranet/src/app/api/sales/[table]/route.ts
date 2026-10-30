import { forbidden, withUser } from "@/lib/server/auth";
import { canUseTable, customerNumberTaken, db, isTable, mayTouch, pick, READ_ONLY, TABLES, visibleRows } from "@/lib/server/db";

type Context = { params: Promise<{ table: string }> };

/** Liste einer Sales-Tabelle. Erlaubte Filter kommen als Query-Parameter,
 * ?ids=a,b holt gezielt einzelne Zeilen. */
export const GET = withUser(async (user, request, { params }: Context) => {
  const { table } = await params;
  if (!isTable(table)) return Response.json({ error: "Unbekannt" }, { status: 404 });
  if (!canUseTable(user, table)) return forbidden();

  const search = new URL(request.url).searchParams;
  const filters: Record<string, string> = {};
  for (const key of TABLES[table].filters) {
    const value = search.get(key);
    if (value !== null) filters[key] = value;
  }
  const ids = search.get("ids")?.split(",").filter(Boolean);
  return Response.json(await visibleRows(user, table, await db().list(table, filters, ids)));
});

export const POST = withUser(async (user, request, { params }: Context) => {
  const { table } = await params;
  if (!isTable(table) || READ_ONLY.includes(table)) {
    return Response.json({ error: "Unbekannt" }, { status: 404 });
  }
  if (!canUseTable(user, table)) return forbidden();
  const row = pick(table, await request.json());
  if (!(await mayTouch(user, table, row))) return forbidden();
  if (table === "customers" && (await customerNumberTaken(row.customer_number))) {
    return Response.json({ error: `Kundennummer ${row.customer_number} ist schon vergeben` }, { status: 409 });
  }
  if (table === "lead_activities") row.author = user.name;
  if (table === "leads" && !row.owner) row.owner = user.email;
  return Response.json(await db().insert(table, row), { status: 201 });
});
