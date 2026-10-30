// Passwort-Tresor: was der Browser zu sehen bekommt. Das Passwort selbst
// kommt nur über /api/vault/[id]/reveal und wird dabei protokolliert.

export type VaultItem = {
  id: string;
  created_at: string;
  updated_at: string;
  /** Kunde aus Aufgaben; null bei internen Zugängen */
  project_id: string | null;
  /** Interne GRID-Zugänge sieht nur die Geschäftsführung */
  internal: boolean;
  title: string;
  username: string | null;
  url: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  has_secret: boolean;
};

export type VaultLogEntry = {
  id: number;
  at: string;
  item_id: string | null;
  item_title: string | null;
  user_email: string;
  action: string;
};

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!?#%&*+-=";

/** Zufälliges Passwort mit Groß-/Kleinbuchstaben, Ziffern und Zeichen */
export function generatePassword(length = 18) {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
