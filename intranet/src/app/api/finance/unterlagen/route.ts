import { withUser } from "@/lib/server/auth";
import { DEMO } from "@/lib/config";
import { check } from "@/lib/server/billing";
import { sb } from "@/lib/server/db";

/** Kundenakte: unterschriebene Unterlagen eines Kunden (?customer_id=) */
export const GET = withUser(async (_user, request) => {
  const customer = new URL(request.url).searchParams.get("customer_id");
  if (DEMO || !customer || !/^[0-9a-f-]{36}$/i.test(customer)) return Response.json([]);
  const rows = check(
    await sb().from("customer_documents").select("id,created_at,kind,title,envelope_id,document_id").eq("customer_id", customer).order("created_at", { ascending: false })
  );
  return Response.json(rows);
}, ["sales", "finance"]);
