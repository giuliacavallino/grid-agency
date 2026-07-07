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
