import { hasConsent } from "@/lib/consent";

/** Meta-Pixel, nur auf der E-Book-Seite und nur nach Einwilligung.
 * Ohne NEXT_PUBLIC_META_PIXEL_ID (Vercel → Environment Variables) bleibt
 * alles aus: kein Banner, kein Skript. */
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export const metaPixelEnabled = Boolean(PIXEL_ID);

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

/** Lädt fbevents.js wie Metas Standard-Snippet: Aufrufe vor dem Laden
 * landen in der Queue und werden danach abgearbeitet. */
export function loadMetaPixel() {
  if (!PIXEL_ID || window.fbq) return;
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  }) as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", PIXEL_ID);
  fbq("track", "PageView");
}

/** Conversion „Lead“ nach erfolgreicher E-Book-Anforderung. */
export function trackMetaLead() {
  if (!metaPixelEnabled || !hasConsent("meta")) return;
  loadMetaPixel();
  window.fbq?.("track", "Lead", { content_name: "E-Book Social Media 2027" });
}

/** Beim Widerruf das Meta-Cookie löschen; das bereits geladene Skript
 * verschwindet mit dem nächsten Seitenaufruf. */
export function clearMetaCookies() {
  const domain = window.location.hostname.replace(/^www\./, "");
  for (const name of ["_fbp", "_fbc"]) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${domain}`;
  }
}
