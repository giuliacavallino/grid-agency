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

const BUCHHALTUNG = "buchhaltung@grid-agency.de";
const HELLO = "hello@grid-agency.de";

function invoice(stage: string, vendor: string, number: string, amount: number, daysAgo: number, dueInDays: number, extra: Record<string, unknown> = {}): Row {
  const received = new Date(Date.now() - daysAgo * day);
  return {
    id: uid(),
    created_at: received.toISOString(),
    updated_at: received.toISOString(),
    stage,
    position: received.getTime() / 1000,
    source_ref: null,
    mailbox: BUCHHALTUNG,
    graph_id: null,
    received_at: received.toISOString(),
    vendor,
    vendor_email: null,
    invoice_number: number,
    invoice_date: received.toISOString().slice(0, 10),
    due_date: new Date(Date.now() + dueInDays * day).toISOString().slice(0, 10),
    amount,
    currency: "EUR",
    description: null,
    attachment_names: [`${number}.pdf`],
    approved_by: stage === "neu" ? null : "Giulia Cavallino",
    approved_at: stage === "neu" ? null : ago(Math.max(0, daysAgo - 1)),
    datev_sent_at: stage === "datev" ? ago(Math.max(0, daysAgo - 2)) : null,
    datev_sent_by: stage === "datev" ? "Giulia Cavallino" : null,
    notes: null,
    raw: null,
    ...extra,
  };
}

const invoices: Row[] = [
  invoice("neu", "Adobe Systems", "IE-2026-118422", 89.24, 1, 14, { source_ref: "demo-mail-3", graph_id: "demo-inv-adobe", vendor_email: "mail@mail.adobe.com", description: "Creative Cloud Oktober" }),
  invoice("neu", "Steffen Video", "2026-041", 1428, 3, 11, { source_ref: "demo-mail-4", graph_id: "demo-inv-steffen", vendor_email: "rechnung@steffen-video.de", description: "Shooting Frittenwerk" }),
  invoice("neu", "Telekom", "9087 1123 4410", 54.9, 6, -1, { description: "Mobilfunk" }),
  invoice("freigegeben", "Canva", "CV-55102", 119.99, 8, 6),
  invoice("datev", "Studio Kreuzberg", "R-2026-88", 650, 20, -6, { description: "Studiomiete Content Day" }),
  invoice("datev", "Hetzner", "R0012345678", 17.85, 25, -12),
];

function application(stage: string, name: string, title: string, daysAgo: number, message: string, extra: Record<string, unknown> = {}): Row {
  return {
    id: uid(),
    created_at: ago(daysAgo),
    updated_at: ago(daysAgo),
    stage,
    position: Date.now() / 1000 - daysAgo * 86400,
    source_ref: null,
    mailbox: HELLO,
    graph_id: null,
    received_at: ago(daysAgo),
    name,
    email: `${slug(name.split(" ")[0])}@example.de`,
    phone: null,
    position_title: title,
    message,
    attachment_names: ["Lebenslauf.pdf"],
    owner: null,
    next_step: null,
    next_step_at: null,
    notes: null,
    raw: null,
    ...extra,
  };
}

const applications: Row[] = [
  application("neu", "Max Meyer", "Content Creator", 1, "Ich produziere seit drei Jahren Reels für Gastro-Accounts und würde gern Teil des Teams werden.", { source_ref: "demo-mail-2", graph_id: "demo-msg-2" }),
  application("neu", "Jana Peters", "Werkstudentin Social Media", 6, "Ich studiere Medienmanagement im 5. Semester."),
  application("gespraech", "Lea Schmitt", "Praktikum Content Creation", 4, "Über Google bin ich auf euch gestoßen.", { mailbox: "google@grid-agency.de", next_step: "Kennenlernen", next_step_at: ago(-2) }),
  application("case_study", "Tom Richter", "Social Media Manager", 12, "Fünf Jahre Agenturerfahrung, zuletzt bei einer Food-Brand.", { next_step: "Case Study abgeben", next_step_at: ago(-4) }),
  application("absage", "Kim Lorenz", "Grafikdesign Freelance", 30, "Portfolio anbei."),
];

const inbound: Row[] = [
  { id: "demo-mail-1", mailbox: HELLO, received_at: ago(2), from_email: "clara@studionord.de", from_name: "Clara Neumann", subject: "Anfrage Social Media", classification: "anfrage", reason: "Fragt nach Betreuung", lead_id: leads[2].id, invoice_id: null, application_id: null },
  { id: "demo-mail-2", mailbox: HELLO, received_at: ago(1), from_email: "max.meyer@gmail.com", from_name: "Max Meyer", subject: "Initiativbewerbung Content Creator", classification: "bewerbung", reason: "Bewerbung mit Lebenslauf", lead_id: null, invoice_id: null, application_id: applications[0].id },
  { id: "demo-mail-3", mailbox: BUCHHALTUNG, received_at: ago(1), from_email: "mail@mail.adobe.com", from_name: "Adobe", subject: "Rechnung Creative Cloud Oktober", classification: "rechnung", reason: "Rechnung mit PDF", lead_id: null, invoice_id: invoices[0].id, application_id: null },
  { id: "demo-mail-4", mailbox: BUCHHALTUNG, received_at: ago(3), from_email: "rechnung@steffen-video.de", from_name: "Steffen Video", subject: "Rechnung 2026-041", classification: "rechnung", reason: "Rechnung eines Freelancers", lead_id: null, invoice_id: invoices[1].id, application_id: null },
];


// Aufgaben: zwei aktive Kunden, ein archivierter
const inDays = (days: number) => new Date(Date.now() + days * day).toISOString().slice(0, 10);
const taskProjects: Row[] = [
  { id: "demo-tp-1", created_at: ago(60), name: "Bäckerei Sonne", color: "#eda100", customer_id: null, position: 1, archived: false, briefing: "Familienbäckerei mit 6 Filialen in Frankfurt.\n\nZugänge: siehe oben (Admin → Passwörter)\n\nInspo Accounts\n\nhttps://www.instagram.com/beispiel.baeckerei/ → findet der Kunde toll\n\nAnsprechpartnerin: Anna Sonne +49 170 0000000\n\nPostingplan\n\n- 3 Posts / Woche\n- 10 Storys / Woche" },
  { id: "demo-tp-2", created_at: ago(40), name: "Pizzeria Forno", color: "#e5484d", customer_id: null, position: 2, archived: false, briefing: null },
  { id: "demo-tp-3", created_at: ago(400), name: "Café Lumen", color: "#afaaa0", customer_id: null, position: 20, archived: true, briefing: "Frühstückscafé in Berlin-Mitte.\n\nPostingplan: 2 Posts / Woche" },
];
const taskSections: Row[] = [
  ["demo-ts-1", "demo-tp-1", "JourFix", 1],
  ["demo-ts-2", "demo-tp-1", "Content Days", 2],
  ["demo-ts-3", "demo-tp-1", "Performance Marketing", 3],
  ["demo-ts-4", "demo-tp-2", "Allgemein", 1],
  ["demo-ts-5", "demo-tp-2", "Influencer", 2],
].map(([id, project_id, name, position]) => ({ id: id as string, created_at: ago(30), project_id, name, position }));
function task(project_id: string, section_id: string, title: string, extra: Record<string, unknown> = {}): Row {
  return { id: uid(), created_at: ago(10), updated_at: ago(1), project_id, section_id, title, notes: null, done: false, done_at: null, assignee: null, due_on: null, checklist: [], position: 1_700_000_000 - seq, ...extra };
}
const tasks: Row[] = [
  task("demo-tp-1", "demo-ts-1", "Halloween-Special abstimmen", { assignee: "Marine Eichner", due_on: inDays(-2) }),
  task("demo-tp-1", "demo-ts-1", "Zugang Meta für Filialleitung", { assignee: "Giulia Cavallino", due_on: inDays(0) }),
  task("demo-tp-1", "demo-ts-1", "Postkarten bestellt?", { done: true, done_at: ago(2), assignee: "Marine Eichner" }),
  task("demo-tp-1", "demo-ts-2", "Nächsten Content Day planen", { assignee: "Marine Eichner", due_on: inDays(5), notes: "Teamfotos je Filiale\nProduktbilder für die Webseite", checklist: [{ text: "Termin mit Filialen", done: true }, { text: "Shotlist", done: false }, { text: "Fotograf buchen", done: false }] }),
  task("demo-tp-1", "demo-ts-2", "Story: Lieblingsprodukt im Büro"),
  task("demo-tp-1", "demo-ts-3", "Ads Catering-Shop", { assignee: "Giulia Cavallino", due_on: inDays(9) }),
  task("demo-tp-2", "demo-ts-4", "TikTok-Zugang klären", { assignee: "Marine Eichner", due_on: inDays(-6) }),
  task("demo-tp-2", "demo-ts-4", "Postinganzahl Ist = Soll prüfen", { done: true, done_at: ago(4) }),
  task("demo-tp-2", "demo-ts-5", "Auf Content von Creator warten", { due_on: inDays(3) }),
];

const tables: Record<string, Row[]> = {
  leads,
  lead_activities: activities,
  customers,
  articles,
  retainers,
  inbound_messages: inbound,
  invoices,
  applications,
  task_projects: taskProjects,
  task_sections: taskSections,
  tasks,
};
const settings: Record<string, unknown> = {
  capacity: { team_hours_per_month: 480 },
  datev: { upload_address: "beispiel@uploadmail.datev.de" },
};

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
    if (table === "invoices" || table === "applications") {
      Object.assign(row, { updated_at: now(), stage: row.stage ?? "neu", position: row.position ?? Date.now() / 1000 });
    }
    if (table === "leads") {
      Object.assign(row, { updated_at: now(), stage: row.stage ?? "neu", status: "offen", position: row.position ?? Date.now() / 1000 });
      tables.lead_activities.unshift({ id: uid(), created_at: now(), lead_id: row.id, kind: "stage", author: null, body: "Lead angelegt", from_stage: null, to_stage: row.stage });
    }
    if (table === "tasks") {
      Object.assign(row, { updated_at: now(), done: row.done ?? false, done_at: row.done ? now() : null, checklist: row.checklist ?? [], notes: row.notes ?? null, assignee: row.assignee ?? null, due_on: row.due_on ?? null, position: row.position ?? Date.now() / 1000 });
    }
    if (table === "task_projects") Object.assign(row, { color: row.color ?? "#afaaa0", archived: row.archived ?? false, briefing: row.briefing ?? null, customer_id: null, position: row.position ?? Date.now() / 1000 });
    if (table === "task_sections") Object.assign(row, { position: row.position ?? Date.now() / 1000 });
    tables[table].push(row);
    return structuredClone(row);
  },
  async insertIgnore(table, input) {
    const exists = tables[table].some((row) =>
      table === "leads"
        ? row.source === input.source && row.source_ref === input.source_ref
        : table === "inbound_messages"
          ? row.id === input.id
          : row.source_ref === input.source_ref
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
    if (table === "tasks" && "done" in patch) row.done_at = patch.done ? (row.done_at ?? now()) : null;
    Object.assign(row, patch, ["leads", "customers", "invoices", "applications", "tasks"].includes(table) ? { updated_at: now() } : {});
    return structuredClone(row);
  },
  async upsertEasybill(table, rows) {
    const out: Row[] = [];
    for (const input of rows) {
      const row = tables[table].find((r) => r.easybill_id === input.easybill_id);
      // Datenbank-Standardwerte nachbilden, die der Abgleich nicht mitschickt
      const defaults = table === "retainers" ? { hours_per_month: 0, notes: null } : table === "articles" ? { hours: 0 } : { lead_id: null, industry: null };
      out.push(row ? await this.update(table, row.id, input) : await this.insert(table, { ...defaults, ...input }));
    }
    return out;
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
