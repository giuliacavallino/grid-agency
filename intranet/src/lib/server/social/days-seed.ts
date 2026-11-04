// Allgemeine Tage (workspace_id null): gesetzliche Feiertage bundesweit und in
// Hessen, Aktionstage mit Social-Media-Bezug und Branchentage für Gastro.
// Bewegliche Termine (Ostern, Advent, Black Friday …) werden aus Regeln
// gerechnet. Quelle für den Demo-Speicher und für die Seed-Zeilen in
// supabase/migrations/20261104090000_marketing_days.sql. Kein "server-only",
// damit das Skript zum Erzeugen der Migration die Datei direkt laden kann.

export type SeedDay = {
  date: string;
  title: string;
  kind: "feiertag" | "aktionstag" | "branche";
  region: string | null;
  note: string;
  industries: string[];
};

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const plus = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

/** Ostersonntag (gregorianisch, anonyme Osterformel) */
export function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

/** n-ter Wochentag (0 = So) im Monat (1–12) */
function nth(year: number, month: number, weekday: number, n: number) {
  let d = utc(year, month, 1);
  while (d.getUTCDay() !== weekday) d = plus(d, 1);
  return plus(d, 7 * (n - 1));
}

/** Letzter Wochentag (0 = So) im Monat (1–12) */
function last(year: number, month: number, weekday: number) {
  let d = utc(year, month + 1, 0);
  while (d.getUTCDay() !== weekday) d = plus(d, -1);
  return d;
}

// Tag- und Nachtgleiche bzw. Sonnenwende (astronomisch, MEZ/MESZ)
const SEASONS: Record<number, { fruehling: string; sommer: string; herbst: string; winter: string }> = {
  2026: { fruehling: "03-20", sommer: "06-21", herbst: "09-23", winter: "12-21" },
  2027: { fruehling: "03-20", sommer: "06-21", herbst: "09-23", winter: "12-22" },
};

const BAKERY = ["baeckerei", "cafe"];

export function seedDays(year: number): SeedDay[] {
  const out: SeedDay[] = [];
  const at = (date: Date | string, title: string, kind: SeedDay["kind"], region: string | null, note: string, industries: string[] = []) =>
    out.push({ date: typeof date === "string" ? `${year}-${date}` : iso(date), title, kind, region, note, industries });

  const e = easter(year);
  const fourthAdvent = (() => {
    let d = utc(year, 12, 24);
    while (d.getUTCDay() !== 0) d = plus(d, -1);
    return d;
  })();
  const thanksgiving = nth(year, 11, 4, 4);
  // Oktoberfest: Anstich am Samstag 15 Tage vor dem ersten Sonntag im Oktober
  const wiesnStart = plus(nth(year, 10, 0, 1), -15);
  const seasons = SEASONS[year];

  // ---------- Gesetzliche Feiertage (bundesweit + Hessen) ----------
  at("01-01", "Neujahr", "feiertag", "DE", "Gesetzlicher Feiertag. Guter Moment für Rückblick, Dank und Vorsätze.");
  at(plus(e, -2), "Karfreitag", "feiertag", "DE", "Gesetzlicher Feiertag, stiller Tag. Öffnungszeiten über Ostern kommunizieren.");
  at(e, "Ostersonntag", "feiertag", "DE", "In Hessen gesetzlicher Feiertag. Ostergrüße und Saisonangebote.");
  at(plus(e, 1), "Ostermontag", "feiertag", "DE", "Gesetzlicher Feiertag.");
  at("05-01", "Tag der Arbeit", "feiertag", "DE", "Gesetzlicher Feiertag. Team und Mitarbeitende zeigen.");
  at(plus(e, 39), "Christi Himmelfahrt", "feiertag", "DE", "Gesetzlicher Feiertag, zugleich Vatertag.");
  at(plus(e, 49), "Pfingstsonntag", "feiertag", "DE", "In Hessen gesetzlicher Feiertag.");
  at(plus(e, 50), "Pfingstmontag", "feiertag", "DE", "Gesetzlicher Feiertag. Langes Wochenende, Ausflugswetter.");
  at(plus(e, 60), "Fronleichnam", "feiertag", "HE", "Feiertag in Hessen (und weiteren Ländern), oft Brückentag am Freitag.");
  at("10-03", "Tag der Deutschen Einheit", "feiertag", "DE", "Gesetzlicher Feiertag.");
  at("12-25", "1. Weihnachtstag", "feiertag", "DE", "Gesetzlicher Feiertag. Weihnachtsgrüße.");
  at("12-26", "2. Weihnachtstag", "feiertag", "DE", "Gesetzlicher Feiertag.");

  // ---------- Aktionstage ----------
  at("01-24", "Tag der Bildung", "aktionstag", null, "Internationaler Tag der Bildung (UN). Wissen teilen, Ausbildung zeigen.");
  at("02-14", "Valentinstag", "aktionstag", null, "Liebe, Wertschätzung, Geschenkideen. Auch: Liebe zum eigenen Handwerk oder zu Kund:innen.");
  at(plus(e, -52), "Weiberfastnacht", "aktionstag", "DE", "Start des Straßenkarnevals. Kostüme im Team, Krawatten ab.");
  at(plus(e, -48), "Rosenmontag", "aktionstag", "DE", "Höhepunkt des Karnevals. Öffnungszeiten, Kostüme, Helau/Alaaf.");
  at("03-08", "Internationaler Frauentag", "aktionstag", null, "Frauen im Team oder in der Branche sichtbar machen.");
  at(seasons ? seasons.fruehling : "03-20", "Frühlingsanfang", "aktionstag", null, "Astronomischer Frühlingsbeginn. Saisonwechsel, neue Produkte, frische Farben.");
  at("03-20", "Weltglückstag", "aktionstag", null, "Internationaler Tag des Glücks (UN). Was macht euer Team oder eure Kund:innen glücklich?");
  at(last(year, 3, 6), "Earth Hour", "aktionstag", null, "Eine Stunde Licht aus für Klimaschutz (WWF). Nachhaltigkeit zeigen.");
  at(last(year, 3, 0), "Beginn der Sommerzeit", "aktionstag", "DE", "Uhren eine Stunde vor. Humorvoller Reminder, längere Abende.");
  at("04-01", "Aprilscherz", "aktionstag", null, "Augenzwinkernder Fake-Post, danach Auflösung.");
  at("04-07", "Weltgesundheitstag", "aktionstag", null, "WHO-Aktionstag. Gesundheit im Team, gesunde Produkte.");
  at("04-22", "Tag der Erde", "aktionstag", null, "Earth Day. Nachhaltigkeit und Umweltschutz im eigenen Betrieb.");
  at("04-23", "Welttag des Buches", "aktionstag", null, "Lieblingsbücher des Teams, Lesetipps.");
  at("05-04", "Star Wars Day", "aktionstag", null, "„May the 4th be with you“. Popkultur-Wortspiel für lockere Marken.");
  at(nth(year, 5, 0, 1), "Weltlachtag", "aktionstag", null, "Am ersten Sonntag im Mai. Lustige Momente aus dem Alltag.");
  at(nth(year, 5, 0, 2), "Muttertag", "aktionstag", "DE", "Zweiter Sonntag im Mai. Danke sagen, Geschenkideen, Aktionen.");
  at(plus(e, 39), "Vatertag / Männertag", "aktionstag", "DE", "Fällt auf Christi Himmelfahrt. Ausflüge, Bollerwagen, Geschenkideen.");
  at("05-15", "Internationaler Tag der Familie", "aktionstag", null, "UN-Aktionstag. Familienbetrieb, Familien als Kund:innen.");
  at("06-05", "Weltumwelttag", "aktionstag", null, "UN-Umwelttag. Nachhaltige Schritte im Betrieb zeigen.");
  at(seasons ? seasons.sommer : "06-21", "Sommeranfang", "aktionstag", null, "Längster Tag des Jahres. Sommerangebote, Draußen-Momente.");
  at("06-30", "Social Media Day", "aktionstag", null, "Welttag der sozialen Medien. Blick hinter die Kulissen eures Kanals, Dank an die Community.");
  at("07-17", "Welt-Emoji-Tag", "aktionstag", null, "World Emoji Day. Post nur aus Emojis, Community rät mit.");
  at("07-30", "Tag der Freundschaft", "aktionstag", null, "Internationaler Tag der Freundschaft (UN). Freund:innen markieren lassen.");
  at(wiesnStart, "Oktoberfest-Anstich", "aktionstag", "BY", "„O’zapft is!“ in München. Wiesn-Stimmung, Tracht, Brezn.");
  at("09-20", "Weltkindertag", "aktionstag", "DE", "Kinderrechte, Familienangebote, Aktionen für Kinder.");
  at(seasons ? seasons.herbst : "09-23", "Herbstanfang", "aktionstag", null, "Astronomischer Herbstbeginn. Saisonwechsel, Herbstprodukte, gemütliche Stimmung.");
  at(nth(year, 10, 5, 1), "Welttag des Lächelns", "aktionstag", null, "Am ersten Freitag im Oktober. Lächelnde Gesichter aus Team und Kundschaft.");
  at(nth(year, 10, 0, 1), "Erntedankfest", "aktionstag", "DE", "Am ersten Sonntag im Oktober. Regionale Produkte, Erzeuger:innen vorstellen.");
  at("10-05", "Weltlehrertag", "aktionstag", null, "UN-Aktionstag. Danke an Lehrkräfte, Ausbilder:innen im Betrieb.");
  at("10-16", "Welternährungstag", "aktionstag", null, "UN-Aktionstag gegen Hunger. Lebensmittel retten, Spendenaktionen.");
  at(last(year, 10, 0), "Ende der Sommerzeit", "aktionstag", "DE", "Uhren eine Stunde zurück. Eine Stunde mehr Schlaf.");
  at("10-31", "Halloween", "aktionstag", null, "Gruselige Deko, Kostüme, Kürbis-Specials.");
  at("11-01", "Weltvegantag", "aktionstag", null, "World Vegan Day. Vegane Produkte und Rezepte zeigen.");
  at("11-11", "Sankt Martin", "aktionstag", "DE", "Martinsumzüge, Laternen, Teilen. Weckmann/Martinsgans.");
  at("11-11", "Start der Karnevalssession", "aktionstag", "DE", "11.11. um 11:11 Uhr. Helau/Alaaf für Marken im Rheinland und in Hessen.");
  at(plus(thanksgiving, 1), "Black Friday", "aktionstag", null, "Rabatt-Tag nach Thanksgiving. Angebote oder bewusst Gegenposition (Green Friday).");
  at(plus(thanksgiving, 2), "Small Business Saturday", "aktionstag", null, "Tag für lokale, kleine Geschäfte. „Kauft lokal“-Botschaft.");
  at(plus(thanksgiving, 4), "Cyber Monday", "aktionstag", null, "Online-Angebotstag nach Black Friday.");
  at(plus(fourthAdvent, -21), "1. Advent", "aktionstag", "DE", "Start der Adventszeit. Adventskalender-Aktionen, Weihnachtsangebote.");
  at(plus(fourthAdvent, -14), "2. Advent", "aktionstag", "DE", "Zweite Kerze. Adventsstimmung, Geschenktipps.");
  at("12-06", "Nikolaus", "aktionstag", "DE", "Stiefel, kleine Überraschungen, Nikolaus-Aktion.");
  at(plus(fourthAdvent, -7), "3. Advent", "aktionstag", "DE", "Dritte Kerze. Last-Minute-Geschenkideen ankündigen.");
  at(plus(fourthAdvent, 0), "4. Advent", "aktionstag", "DE", "Letzter Advent. Öffnungszeiten über die Feiertage.");
  at(seasons ? seasons.winter : "12-21", "Winteranfang", "aktionstag", null, "Kürzester Tag des Jahres. Gemütlichkeit, Lichter.");
  at("12-24", "Heiligabend", "aktionstag", "DE", "Weihnachtsgrüße, Öffnungszeiten, Dank an die Kundschaft.");
  at("12-31", "Silvester", "aktionstag", "DE", "Jahresrückblick, Dank, Ausblick aufs neue Jahr.");

  // ---------- Branchentage Gastronomie (nur bei passenden Kunden) ----------
  at("01-30", "Internationaler Tag des Croissants", "branche", null, "National Croissant Day. Croissant-Varianten, Backstube, Blätterteig-Handwerk.", BAKERY);
  at("02-09", "Tag der Pizza", "branche", null, "World Pizza Day. Lieblingspizza, Teig-Handwerk, Abstimmung.", ["pizza", "restaurant"]);
  at("04-26", "Tag der Brezel", "branche", null, "National Pretzel Day. Brezel schlingen im Video, Brezel-Varianten.", ["baeckerei"]);
  at("05-05", "Tag des Deutschen Brotes", "branche", "DE", "Aktionstag des Deutschen Brotinstituts. Brotkultur, Sorten, Handwerk.", ["baeckerei"]);
  at("10-01", "Tag des Kaffees", "branche", null, "Internationaler Tag des Kaffees (International Coffee Day). Kaffeespezialitäten, Röstung, Kaffee-Aktion.", BAKERY);
  at("10-16", "Welttag des Brotes", "branche", null, "Weltbrottag. Brot als Grundnahrungsmittel, Sauerteig, Brot retten.", ["baeckerei", "restaurant"]);

  return out;
}

/** Alle Seed-Tage der Jahre (Standard: 2026 und 2027) */
export const seedAll = (years = [2026, 2027]) => years.flatMap(seedDays);
