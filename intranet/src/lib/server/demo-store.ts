import "server-only";
import type { Row, Store, TableName } from "./db";

// Speicher für die lokale Vorschau (NEXT_PUBLIC_INTRANET_DEMO=1): Beispieldaten
// im Arbeitsspeicher, verhält sich wie die Supabase-Tabellen inkl. Trigger.

const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();
const slug = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
const date = (offsetMonths: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths, 1);
  return d.toISOString().slice(0, 10);
};
let seq = 0;
const uid = () => `demo-${(++seq).toString().padStart(4, "0")}`;

function lead(
  stage: string,
  source: string,
  name: string,
  company: string,
  value: number | null,
  daysAgo: number,
  message: string,
  extra: Record<string, unknown> = {}
): Row {
  return {
    id: uid(),
    created_at: ago(daysAgo),
    updated_at: ago(Math.max(0, daysAgo - 1)),
    stage,
    position: Date.now() / 1000 - daysAgo * 86400,
    status: "offen",
    source,
    source_ref: null,
    name,
    company,
    email: `${name.split(" ")[0].toLowerCase()}@${slug(company)}.de`,
    phone: null,
    message,
    budget: null,
    value,
    owner: null,
    next_step: null,
    next_step_at: null,
    customer_id: null,
    won_at: stage === "gewonnen" ? ago(Math.max(0, daysAgo - 20)) : null,
    lost_reason: null,
    ...extra,
  };
}

const customers: Row[] = [
  ["Casa Beef", "Marco Rossi", "Gastronomie", "Berlin", 210],
  ["Frittenwerk", "Lena Kühn", "Gastronomie", "Frankfurt", 400],
  ["Goldies", "Tim Becker", "Gastronomie", "Berlin", 160],
  ["Sajent Club", "Aylin Demir", "Nightlife", "Berlin", 300],
  ["Lovebirds", "Sophie Wagner", "Fashion", "Frankfurt", 120],
  ["Smash Burger Co.", "Jonas Hartmann", "Gastronomie", "Berlin", 60],
].map(([name, contact, industry, city, since]) => ({
  id: uid(),
  created_at: ago(Number(since)),
  updated_at: ago(3),
  name,
  contact_name: contact,
  email: `${String(contact).split(" ")[0].toLowerCase()}@${slug(String(name))}.de`,
  phone: "+49 30 1234567",
  website: `https://${slug(String(name))}.de`,
  industry,
  city,
  status: "aktiv",
  source: "empfehlung",
  notes: null,
  lead_id: null,
}));

const articles: Row[] = [
  ["Social Media Betreuung S", "Retainer", "2 Kanäle, 8 Posts und 8 Stories im Monat, Community Management werktags", 1490, "monatlich", 18],
  ["Social Media Betreuung M", "Retainer", "3 Kanäle, 12 Posts, 20 Stories, 4 Reels im Monat, Community Management", 2490, "monatlich", 32],
  ["Social Media Betreuung L", "Retainer", "Alle Kanäle, Content-Produktion vor Ort, Reels-Serie, Reporting", 3990, "monatlich", 54],
  ["Paid Social Management", "Retainer", "Meta- und TikTok-Ads: Setup, Creatives, Optimierung, Reporting", 890, "monatlich", 10],
  ["Content Shooting (Tag)", "Produktion", "Foto und Video vor Ort, inkl. Schnitt von 6 Reels", 1800, "tag", 10],
  ["Strategie-Workshop", "Beratung", "Halbtägiger Workshop mit Kanalstrategie und Content-Säulen", 1200, "einmalig", 8],
  ["Influencer Kampagne", "Kampagne", "Recherche, Briefing und Abwicklung von bis zu 10 Creator*innen", 2900, "einmalig", 24],
  ["Event-Content", "Produktion", "Begleitung eines Events mit Live-Stories und Recap-Reel", 95, "stunde", 1],
].map(([name, category, description, price, unit, hours]) => ({
  id: uid(),
  created_at: ago(200),
  name,
  category,
  description,
  price,
  unit,
  hours,
  active: true,
}));

const retainers: Row[] = [
  [0, 1, "Social Media Betreuung M", 2490, 32, -7, null],
  [0, 3, "Paid Social", 890, 10, -4, null],
  [1, 2, "Social Media Betreuung L", 3990, 54, -13, null],
  [2, 0, "Social Media Betreuung S", 1490, 18, -5, null],
  [3, 1, "Social Media Betreuung M", 2490, 32, -9, 2],
  [4, 0, "Social Media Betreuung S", 1490, 18, -3, null],
  [5, 3, "Paid Social", 890, 10, -1, null],
  [5, 0, "Social Media Betreuung S", 1290, 18, -1, null],
].map(([c, a, title, fee, hours, start, end]) => ({
  id: uid(),
  created_at: ago(30),
  customer_id: customers[Number(c)].id,
  article_id: articles[Number(a)].id,
  title,
  monthly_fee: fee,
  hours_per_month: hours,
  start_date: date(Number(start)),
  end_date: end === null ? null : date(Number(end)),
  status: "aktiv",
  notes: null,
}));

const leads: Row[] = [
  lead("neu", "website", "Nina Schröder", "Café Morgenrot", 1490, 0, "Hallo! Wir eröffnen im Dezember ein zweites Café und suchen jemanden für Instagram und TikTok. Budget ca. 1.500 € im Monat."),
  lead("neu", "instagram", "Deniz Aksoy", "Kebabhaus 36", null, 1, "Lead Ads Formular: Interesse an Social Media Betreuung"),
  lead("neu", "email", "Clara Neumann", "Studio Nord", 2490, 2, "Liebes GRID-Team, wir sind ein Interior-Studio und möchten unseren Auftritt neu aufsetzen. Habt ihr nächste Woche Zeit für ein Gespräch?"),
  lead("neu", "linkedin", "Felix Brandt", "Brandt Immobilien", 3990, 3, "LinkedIn Lead Gen: Employer Branding und LinkedIn-Content"),
  lead("neu", "meta", "Mia Hoffmann", "Yoga Loft", 890, 4, "Facebook Lead Ads: Paid Social"),
  lead("eingeladen", "website", "Paul Richter", "Richter & Söhne Bäckerei", 1490, 6, "Wir möchten mehr junge Leute erreichen.", { next_step: "Erstgespräch bestätigen", next_step_at: ago(-2) }),
  lead("eingeladen", "empfehlung", "Hannah Krüger", "Bloom Florist", 1490, 8, "Empfehlung von Goldies"),
  lead("erstgespraech", "email", "Leon Wolf", "Wolf Fitness", 2490, 12, "Anfrage für Reels-Serie und Ads", { next_step: "Angebot schreiben", next_step_at: ago(-1) }),
  lead("erstgespraech", "instagram", "Emma Schulz", "Pasta Madre", 2490, 15, "Instagram DM → Lead Ads"),
  lead("angebot", "website", "Lukas Zimmermann", "Urban Sneakers", 3990, 18, "Launch-Kampagne für neuen Store", { next_step: "Nachfassen", next_step_at: ago(-3) }),
  lead("angebot", "linkedin", "Sarah Braun", "Kanzlei Braun", 1490, 21, "LinkedIn-Betreuung für Partner*innen"),
  lead("gewonnen", "empfehlung", "Jonas Hartmann", "Smash Burger Co.", 2180, 40, "Neueröffnung Berlin-Mitte", { customer_id: customers[5].id }),
  lead("gewonnen", "website", "Sophie Wagner", "Lovebirds", 1490, 95, "Fashion-Brand sucht Agentur", { customer_id: customers[4].id }),
];

const activities: Row[] = leads.map((l) => ({
  id: uid(),
  created_at: l.created_at,
  lead_id: l.id,
  kind: "stage",
  author: null,
  body: "Lead angelegt",
  from_stage: null,
  to_stage: "neu",
}));

const inbound: Row[] = [
  { id: "demo-mail-1", received_at: ago(2), from_email: "clara@studionord.de", from_name: "Clara Neumann", subject: "Anfrage Social Media", classification: "anfrage", reason: "Fragt nach Betreuung", lead_id: leads[2].id },
  { id: "demo-mail-2", received_at: ago(1), from_email: "max.meyer@gmail.com", from_name: "Max Meyer", subject: "Initiativbewerbung Content Creator", classification: "bewerbung", reason: "Bewerbung mit Lebenslauf", lead_id: null },
];

const tables: Record<string, Row[]> = {
  leads,
  lead_activities: activities,
  customers,
  articles,
  retainers,
  inbound_messages: inbound,
};
const settings: Record<string, unknown> = { capacity: { team_hours_per_month: 480 } };

const now = () => new Date().toISOString();

export const demoStore: Store = {
  async list(table, filters = {}, ids) {
    let rows = tables[table].filter((row) =>
      Object.entries(filters).every(([key, value]) => String(row[key]) === value)
    );
    if (ids) rows = rows.filter((row) => ids.includes(row.id));
    return structuredClone(rows);
  },
  async get(table, id) {
    return structuredClone(tables[table].find((row) => row.id === id) ?? null);
  },
  async insert(table, input) {
    const row: Row = { id: uid(), created_at: now(), ...input } as Row;
    if (table === "leads") {
      Object.assign(row, { updated_at: now(), stage: row.stage ?? "neu", status: "offen", position: row.position ?? Date.now() / 1000 });
      tables.lead_activities.unshift({ id: uid(), created_at: now(), lead_id: row.id, kind: "stage", author: null, body: "Lead angelegt", from_stage: null, to_stage: row.stage });
    }
    tables[table].push(row);
    return structuredClone(row);
  },
  async insertIgnore(table, input) {
    const exists = tables[table].some((row) =>
      table === "leads"
        ? row.source === input.source && row.source_ref === input.source_ref
        : row.id === input.id
    );
    return exists ? null : this.insert(table as TableName, input);
  },
  async update(table, id, patch) {
    const row = tables[table].find((r) => r.id === id);
    if (!row) throw new Error("Nicht gefunden");
    if (table === "leads" && patch.stage && patch.stage !== row.stage) {
      tables.lead_activities.unshift({ id: uid(), created_at: now(), lead_id: id, kind: "stage", author: null, body: null, from_stage: row.stage, to_stage: patch.stage });
      if (patch.stage === "gewonnen" && !row.won_at) row.won_at = now();
    }
    Object.assign(row, patch, table === "leads" || table === "customers" ? { updated_at: now() } : {});
    return structuredClone(row);
  },
  async remove(table, id) {
    tables[table] = tables[table].filter((row) => row.id !== id);
  },
  async getSetting(key) {
    return (settings[key] ?? null) as never;
  },
  async setSetting(key, value) {
    settings[key] = value;
  },
};
