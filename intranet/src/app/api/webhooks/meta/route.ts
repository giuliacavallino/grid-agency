import { after } from "next/server";
import { saveAdLead } from "@/lib/server/ad-leads";
import { hmacHex, safeEqual } from "@/lib/server/signature";

export const maxDuration = 60;

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v23.0"}`;

/** Bestätigung beim Einrichten des Webhooks in der Meta-App. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = process.env.META_VERIFY_TOKEN;
  if (params.get("hub.mode") === "subscribe" && token && safeEqual(params.get("hub.verify_token") ?? "", token)) {
    return new Response(params.get("hub.challenge") ?? "", { headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Nicht erlaubt", { status: 403 });
}

type LeadgenChange = { field: string; value: { leadgen_id?: string; form_id?: string; ad_id?: string } };
type MetaLead = {
  id: string;
  created_time: string;
  platform?: string;
  ad_name?: string;
  campaign_name?: string;
  form_id?: string;
  field_data: { name: string; values: string[] }[];
};

// Standardfelder der Lead-Formulare; alles andere landet in der Nachricht
const FIELD_MAP: Record<string, "name" | "email" | "phone" | "company"> = {
  full_name: "name",
  email: "email",
  phone_number: "phone",
  company_name: "company",
};

/** Neue Leads aus Facebook- und Instagram-Lead-Ads (Feld "leadgen"). */
export async function POST(request: Request) {
  const secret = process.env.META_APP_SECRET;
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!secret || !pageToken) return new Response("Nicht eingerichtet", { status: 503 });

  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!safeEqual(signature, `sha256=${hmacHex(secret, raw)}`)) {
    return new Response("Signatur ungültig", { status: 401 });
  }

  const body = JSON.parse(raw) as { entry?: { changes?: LeadgenChange[] }[] };
  const ids = (body.entry ?? [])
    .flatMap((entry) => entry.changes ?? [])
    .filter((change) => change.field === "leadgen" && change.value.leadgen_id)
    .map((change) => change.value.leadgen_id!);

  after(async () => {
    for (const id of ids) {
      try {
        const fields = "created_time,field_data,platform,ad_name,campaign_name,form_id";
        const response = await fetch(`${GRAPH}/${id}?fields=${fields}&access_token=${pageToken}`);
        if (!response.ok) throw new Error(`Meta ${response.status}: ${await response.text()}`);
        const lead = (await response.json()) as MetaLead;

        const mapped: Partial<Record<"name" | "email" | "phone" | "company", string>> = {};
        const answers = [];
        for (const field of lead.field_data) {
          const value = field.values.join(", ");
          const key = FIELD_MAP[field.name];
          if (key) mapped[key] = value;
          else if (field.name === "first_name" || field.name === "last_name") {
            mapped.name = [mapped.name, value].filter(Boolean).join(" ");
          } else answers.push({ label: field.name.replaceAll("_", " "), value });
        }

        await saveAdLead({
          source: lead.platform === "ig" ? "instagram" : "meta",
          ref: lead.id,
          createdAt: lead.created_time,
          fields: mapped,
          answers,
          context: [lead.campaign_name && `Kampagne: ${lead.campaign_name}`, lead.ad_name && `Anzeige: ${lead.ad_name}`]
            .filter(Boolean)
            .join("\n"),
          raw: lead,
        });
      } catch (error) {
        console.error("Meta-Lead konnte nicht übernommen werden:", error);
      }
    }
  });
  return new Response("OK");
}
