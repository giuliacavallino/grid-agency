/** Smooth-scroll to a section without writing a #hash into the URL,
 * so reloads always start at the top of the page. */
export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}
