/** Das Intranet nimmt Kontaktanfragen und Terminbuchungen entgegen (prüft
 * das Captcha, legt Leads an, trägt Termine in den Kalender ein). */
export const INTRANET_URL = process.env.INTRANET_URL ?? "https://intranet.grid-agency.de";

export async function intranet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${INTRANET_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Da ist etwas schiefgelaufen. Bitte versuch es später erneut.");
  return data;
}
