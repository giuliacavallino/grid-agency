// Vorbelegter Klartext und Standard-Signatur für Mails aus dem Intranet
// (Verfassen-Fenster, Follow-up-Entwürfe nach Calls)

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Klartext (z. B. Absage aus der Pipeline, Follow-up) als Absätze */
export const textToHtml = (text?: string) =>
  (text ?? "")
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p><p><br></p>`)
    .join("");

export function signatureHtml(name: string, mailbox: string) {
  return `<p style="margin:16px 0 0">Beste Grüße<br><strong>${escape(name)}</strong><br>GRID AGENCY · <a href="https://grid-agency.de">grid-agency.de</a><br><span style="color:#6b665f">${escape(mailbox)}</span></p>`;
}
