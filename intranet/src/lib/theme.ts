/** Akzentfarbe (Quelle, Phase, Kalender …) als lesbare Textfarbe in beiden
 * Modi: im Dunklen heller, im Hellen dunkler gemischt (--accent-mix). */
export const accentText = (color: string) =>
  `color-mix(in srgb, ${color} var(--accent-mix), var(--color-snow))`;

/** Dezente Fläche in der Akzentfarbe, z. B. für Badges und Termine. */
export const accentFill = (color: string, amount = 16) =>
  `color-mix(in srgb, ${color} ${amount}%, transparent)`;
