// Rendert das E-Book als PDF nach public/ebook/, von dort lädt die
// Landingpage /ebook es herunter, dazu das Cover als Bild für die Seite.
// Aufruf: node ebook/render.mjs
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

// require statt import: Playwright ist global installiert, nicht im Projekt.
const { chromium } = createRequire(import.meta.url)("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "ebook", "social-media-2027.pdf");
const cover = join(here, "..", "public", "ebook", "cover.jpg");
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(`file://${join(here, "social-media-2027.html")}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

// Verlaufsschrift (.grad) als hochaufgelöstes Bild neu setzen: Chromium
// druckt um background-clip: text Haarlinien, und Verlaufsfüllung auf
// echtem Text zeigen manche PDF-Viewer mit der variablen Schrift als Fläche.
await page.evaluate(() => {
  const stops = [[0, "#feda75"], [0.35, "#fa7e1e"], [0.7, "#d62976"], [1, "#962fbf"]];
  const scale = 4;
  document.querySelectorAll(".grad").forEach((el) => {
    const box = el.getBoundingClientRect();
    const probe = document.createElement("span");
    probe.style.cssText = "display:inline-block;width:0;height:0";
    el.appendChild(probe);
    const baseline = probe.getBoundingClientRect().top - box.top;
    probe.remove();
    const range = document.createRange();
    range.selectNodeContents(el);
    const textWidth = range.getBoundingClientRect().width;
    const cs = getComputedStyle(el);

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(box.width * scale);
    canvas.height = Math.ceil(box.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
    const fill = ctx.createLinearGradient(0, 0, textWidth, 0);
    for (const [offset, color] of stops) fill.addColorStop(offset, color);
    ctx.fillStyle = fill;
    ctx.fillText(el.textContent, 0, baseline);

    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/png");
    img.alt = el.textContent;
    img.style.cssText = `width:${box.width}px;height:${box.height}px;vertical-align:${baseline - box.height}px`;
    el.textContent = "";
    el.style.background = "none";
    el.appendChild(img);
  });
});
await page.waitForFunction(() => [...document.images].every((i) => i.complete));

await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
await page.locator(".cover").screenshot({ path: cover, type: "jpeg", quality: 82 });
await browser.close();
console.log(out);
console.log(cover);
