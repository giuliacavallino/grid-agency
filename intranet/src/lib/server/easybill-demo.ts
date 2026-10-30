import "server-only";

// Beispielantworten der easybill-API für die lokale Vorschau.
const today = new Date();
const iso = (offsetDays: number) => new Date(today.getTime() + offsetDays * 86_400_000).toISOString();

const customers = [
  { id: 9001, company_name: "Bäckerei Huck", first_name: "Anna", last_name: "Huck", emails: ["anna@baeckerei-huck.de"], phone_1: "+49 69 123456", mobile: null, internet: "https://baeckerei-huck.de", city: "Frankfurt", note: null, acquire_options: 1, archived: false },
  { id: 9002, company_name: "Casualfood GmbH", first_name: "Lisa", last_name: "Brandt", emails: ["lisa.brandt@casualfood.de"], phone_1: null, mobile: "+49 171 555", internet: null, city: "Frankfurt", note: null, acquire_options: 3, archived: false },
  { id: 9003, company_name: "Alt Kunde AG", first_name: null, last_name: null, emails: [], phone_1: null, mobile: null, internet: null, city: "Berlin", note: null, acquire_options: null, archived: true },
];

const positions = [
  { id: 7001, number: "SM-M", description: "Social Media Betreuung M\n3 Kanäle, 12 Posts, 4 Reels", note: null, unit: "Monat", sale_price: 249000, group_id: 50, archived: false },
  { id: 7002, number: "SHOOT", description: "Content Shooting", note: null, unit: "Tag", sale_price: 180000, group_id: 51, archived: false },
];

const groups = [
  { id: 50, name: "Retainer" },
  { id: 51, name: "Produktion" },
];

const recurring = [
  { id: 6001, number: null, title: "Social Media Betreuung", customer_id: 9001, document_date: iso(-120), created_at: iso(-120), amount_net: 249000, status: null, is_draft: false, items: [{ description: "Social Media Betreuung M", position_id: 7001 }], recurring_options: { frequency: "MONTHLY", interval: 1, status: "RUNNING", end_date_or_count: null, next_date: iso(10) } },
  { id: 6002, number: null, title: "Google-Profile Pflege", customer_id: 9002, document_date: iso(-60), created_at: iso(-60), amount_net: 270000, status: null, is_draft: false, items: [{ description: "Google Business Profile", position_id: null }], recurring_options: { frequency: "MONTHLY", interval: 3, status: "RUNNING", end_date_or_count: null, next_date: iso(20) } },
];

const offers = [
  { id: 5001, number: "AN-2026-031", title: "Launch-Kampagne Wintersortiment", customer_id: 9002, document_date: iso(-5).slice(0, 10), created_at: iso(-5), amount_net: 450000, status: null, is_draft: false, items: [] },
  { id: 5002, number: "AN-2026-020", title: "Abgeschlossen", customer_id: 9001, document_date: iso(-40).slice(0, 10), created_at: iso(-40), amount_net: 100000, status: "ACCEPT", is_draft: false, items: [] },
];

export function demoEasybill(path: string): unknown[] {
  if (path.startsWith("/customers")) return customers;
  if (path.startsWith("/positions")) return positions;
  if (path.startsWith("/position-groups")) return groups;
  if (path.includes("type=RECURRING")) return recurring;
  if (path.includes("type=OFFER")) return offers;
  return [];
}
