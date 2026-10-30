/** Smooth-scroll to a section without writing a #hash into the URL,
 * so reloads always start at the top of the page. */
export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

/* Cross-page section navigation: the AppShell strips #hashes and resets
 * scroll on mount, so subpages stash the target section here and the
 * shell picks it up right after its reset. */

const SCROLL_TARGET_KEY = "grid-scroll-target";

export function stashScrollTarget(id: string) {
  try {
    sessionStorage.setItem(SCROLL_TARGET_KEY, id);
  } catch {
    /* storage unavailable — link still lands on the homepage */
  }
}

export function popScrollTarget(): string | null {
  try {
    const v = sessionStorage.getItem(SCROLL_TARGET_KEY);
    if (v) sessionStorage.removeItem(SCROLL_TARGET_KEY);
    return v;
  } catch {
    return null;
  }
}

/* Kontaktbereich (#dm) mit gewähltem Tab öffnen: Termin buchen oder
 * Nachricht schreiben. Auf der Startseite per Event, von Unterseiten über
 * sessionStorage, das DmSection beim Mount ausliest. */

export type ContactTab = "termin" | "nachricht";
export const CONTACT_TAB_EVENT = "grid:contact-tab";
const CONTACT_TAB_KEY = "grid-contact-tab";

export function selectContactTab(tab: ContactTab) {
  window.dispatchEvent(new CustomEvent<ContactTab>(CONTACT_TAB_EVENT, { detail: tab }));
}

export function stashContactTab(tab: ContactTab) {
  try {
    sessionStorage.setItem(CONTACT_TAB_KEY, tab);
  } catch {
    /* ohne Storage öffnet der Standard-Tab */
  }
}

export function popContactTab(): ContactTab | null {
  try {
    const v = sessionStorage.getItem(CONTACT_TAB_KEY);
    if (v) sessionStorage.removeItem(CONTACT_TAB_KEY);
    return v === "termin" || v === "nachricht" ? v : null;
  } catch {
    return null;
  }
}
