/** Einwilligungen für externe Dienste: Calendly und das Meta-Pixel auf
 * der E-Book-Seite.
 *
 * Gespeichert wird nur, wenn die Person "merken" wählt, und zwar im
 * localStorage ihres Browsers, nicht als Cookie und nicht auf unserem
 * Server. Das Speichern der Entscheidung selbst ist technisch
 * erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Widerruf jederzeit über
 * /datenschutz#einstellungen. */

export type ConsentService = "calendly" | "meta";

const KEY = (service: ConsentService) => `grid-consent-${service}`;
const EVENT = "grid-consent-change";

export function hasConsent(service: ConsentService): boolean {
  try {
    return window.localStorage.getItem(KEY(service)) === "granted";
  } catch {
    return false;
  }
}

/** "granted", "denied" oder null, solange nicht entschieden wurde. Für
 * das Meta-Pixel merken wir auch die Ablehnung, damit das Banner nicht
 * bei jedem Besuch wiederkommt. */
export function consentState(service: ConsentService): "granted" | "denied" | null {
  try {
    const value = window.localStorage.getItem(KEY(service));
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function denyConsent(service: ConsentService) {
  try {
    window.localStorage.setItem(KEY(service), "denied");
  } catch {
    // Ohne Speicher fragt das Banner beim nächsten Mal einfach erneut.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function grantConsent(service: ConsentService) {
  try {
    window.localStorage.setItem(KEY(service), "granted");
  } catch {
    // Ohne Speicher fragt der Dialog beim nächsten Mal einfach erneut.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function revokeConsent(service: ConsentService) {
  try {
    window.localStorage.removeItem(KEY(service));
  } catch {
    // nichts gespeichert, nichts zu widerrufen
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onConsentChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
