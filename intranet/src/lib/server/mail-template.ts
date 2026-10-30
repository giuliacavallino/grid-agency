import "server-only";

// HTML-Mails an Kund*innen (Angebot, Einladungen, Abschluss) im GRID-Look:
// Farbbalken, große Überschrift, ein Button statt Link und darunter die
// Signatur wie in Outlook (Name, Rolle, Kontakt, Termin-Button, Logo,
// Social-Icons, Bildleiste, Claim, Pflichtangaben). Bilder liegen auf der
// Website unter /mail, damit sie in jedem Mailprogramm laden.

const ASSETS = `${process.env.WEBSITE_URL ?? "https://grid-agency.de"}/mail`;
const INK = "#2b2926";
const MUTED = "#8a847b";

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type Sender = { name: string; role: string; phone?: string; email: string };

/** Absender*in der Signatur; Giulia mit Rolle und Telefon, sonst das Team */
export function senderFor(name: string, email?: string): Sender {
  if (/giulia/i.test(name) || email?.startsWith("giulia.")) {
    return { name: "Giulia Cavallino", role: "Geschäftsführung", phone: "+49 151 22910161", email: "giulia.cavallino@grid-agency.de" };
  }
  return { name, role: "GRID Agency", email: email && !email.startsWith("hello@") ? email : "hello@grid-agency.de" };
}

function signature(sender: Sender) {
  const link = (href: string, text: string) => `<a href="${href}" style="color:${INK};text-decoration:underline">${escape(text)}</a>`;
  return `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:40px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK}">
  <tr>
    <td valign="top" style="padding:0 24px 0 0;border-right:1px solid #d8d5cf">
      <p style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.3px">${escape(sender.name)}</p>
      <p style="margin:6px 0 18px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${MUTED}">${escape(sender.role)}</p>
      <p style="margin:0;font-size:14px;line-height:1.7">
        ${sender.phone ? `${link(`tel:${sender.phone.replace(/\s/g, "")}`, sender.phone)}<br>` : ""}
        ${link(`mailto:${sender.email}`, sender.email)}<br>
        ${link("https://grid-agency.de", "www.grid-agency.de")}
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr>
        <td style="background:${INK}"><a href="https://grid-agency.de/termin" style="display:inline-block;padding:12px 20px;font-size:13px;font-weight:600;letter-spacing:0.5px;color:#ffffff;text-decoration:none">JETZT TERMIN BUCHEN</a></td>
      </tr></table>
    </td>
    <td valign="top" style="padding:0 0 0 24px;width:150px">
      <img src="${ASSETS}/grid-logo.png" width="120" alt="GRID" style="display:block;border:0;width:120px;height:auto">
      <p style="margin:16px 0 0">
        <a href="https://www.instagram.com/grid.berlin/"><img src="${ASSETS}/instagram.png" width="22" height="22" alt="Instagram" style="border:0;margin-right:14px"></a>
        <a href="https://www.linkedin.com/company/grid-agency-gmbh/"><img src="${ASSETS}/linkedin.png" width="22" height="22" alt="LinkedIn" style="border:0;margin-right:14px"></a>
        <a href="https://grid-agency.de"><img src="${ASSETS}/web.png" width="22" height="22" alt="Website" style="border:0"></a>
      </p>
    </td>
  </tr>
  <tr><td colspan="2" style="padding-top:22px">
    <a href="https://grid-agency.de/projekte"><img src="${ASSETS}/signatur-collage.jpg" width="560" alt="Content von GRID" style="display:block;border:0;width:100%;max-width:560px;height:auto"></a>
  </td></tr>
  <tr><td colspan="2" style="padding-top:16px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${INK}">We create content that keeps your brand in focus.</td></tr>
  <tr><td colspan="2" style="padding-top:12px;font-size:11px;line-height:1.5;color:${MUTED}">
    GRID Agency UG | Eichendorffstraße 32, 60320 Frankfurt am Main | Geschäftsführung: Giulia Cavallino | Amtsgericht Berlin-Charlottenburg, HRB 235987 B
  </td></tr>
</table>`;
}

/** Mail mit Kicker, Überschrift, Absätzen, einem Button und Signatur */
export function brandedMail(input: {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  button?: { label: string; href: string };
  note?: string;
  sender: Sender;
}) {
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${INK};max-width:560px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:30px"><tr>
<td style="height:5px;background:#feda75"></td><td style="height:5px;background:#fa7e1e"></td><td style="height:5px;background:#d62976"></td><td style="height:5px;background:#962fbf"></td>
</tr></table>
<p style="margin:0 0 8px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#fa7e1e;font-weight:600">${escape(input.eyebrow)}</p>
<p style="margin:0 0 22px;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.5px">${escape(input.title)}</p>
${input.paragraphs.map((p) => `<p style="margin:0 0 14px">${escape(p)}</p>`).join("\n")}
${
  input.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 8px"><tr><td style="border-radius:999px;background:${INK};border-bottom:3px solid #fa7e1e">
<a href="${input.button.href}" style="display:inline-block;padding:16px 34px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escape(input.button.label)} &rarr;</a>
</td></tr></table>`
    : ""
}
${input.note ? `<p style="margin:14px 0 0;font-size:13px;color:${MUTED}">${escape(input.note)}</p>` : ""}
${signature(input.sender)}
</div>`;
}
