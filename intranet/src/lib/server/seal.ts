import "server-only";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import forge from "node-forge";
import { SignPdf } from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { PDFDocument } from "pdf-lib";
import { sb } from "./db";

// Siegel von GRID AGENCY UG auf unterschriebenen Unterlagen (PAdES/CMS über
// das ganze Dokument): Jede spätere Änderung macht die Signatur ungültig.
// Zertifikat: SIGN_P12_BASE64 / SIGN_P12_PASSWORD (z. B. ein gekauftes),
// sonst ein selbst ausgestelltes, das der Server beim ersten Gebrauch erzeugt
// und verschlüsselt im Supabase Vault ablegt (Schlüssel verlässt den Server nie).

export class SealError extends Error {}

type Seal = { p12: string; password: string; fingerprint?: string };

export function createSelfSigned(): Seal {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
  const key = forge.pki.privateKeyFromPem(privateKey.export({ type: "pkcs8", format: "pem" }).toString());
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey.export({ type: "spki", format: "pem" }).toString());
  cert.serialNumber = `01${randomBytes(15).toString("hex")}`;
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 10 * 365 * 86_400_000);
  const subject = [
    { name: "countryName", value: "DE" },
    { name: "localityName", value: "Frankfurt am Main" },
    { name: "organizationName", value: "GRID AGENCY UG" },
    { name: "commonName", value: "GRID AGENCY UG Dokumentensiegel" },
    { name: "emailAddress", value: "buchhaltung@grid-agency.de" },
  ];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.setExtensions([
    { name: "basicConstraints", cA: false, critical: true },
    { name: "keyUsage", digitalSignature: true, nonRepudiation: true, critical: true },
    // Document Signing (Microsoft) und E-Mail-Schutz
    { name: "extKeyUsage", emailProtection: true, "1.3.6.1.4.1.311.10.3.12": true },
    { name: "subjectKeyIdentifier" },
  ]);
  cert.sign(key, forge.md.sha256.create());
  const password = randomBytes(24).toString("hex");
  const asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], password, { algorithm: "3des", friendlyName: "GRID AGENCY UG" });
  const der = forge.asn1.toDer(asn1).getBytes();
  const fingerprint = forge.md.sha256.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()).digest().toHex();
  return { p12: forge.util.encode64(der), password, fingerprint };
}

let cached: Seal | null = null;

async function seal(): Promise<Seal> {
  if (process.env.SIGN_P12_BASE64) return { p12: process.env.SIGN_P12_BASE64, password: process.env.SIGN_P12_PASSWORD ?? "" };
  if (cached) return cached;
  const stored = await sb().rpc("seal_secret_get");
  if (stored.error) throw new SealError(stored.error.message);
  if (stored.data) return (cached = stored.data as Seal);
  // Erster Gebrauch: erzeugen; bei zwei gleichzeitigen Läufen gewinnt der erste
  const created = await sb().rpc("seal_secret_set", { p: createSelfSigned() });
  if (created.error) throw new SealError(created.error.message);
  return (cached = created.data as Seal);
}

/** SHA-256-Fingerabdruck des Siegel-Zertifikats (für das Abschlussprotokoll) */
export async function sealFingerprint() {
  const s = await seal();
  if (s.fingerprint) return s.fingerprint;
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(s.p12)), s.password);
  const bag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
  return bag?.cert ? forge.md.sha256.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(bag.cert)).getBytes()).digest().toHex() : "";
}

export async function sealPdf(pdf: Buffer, info: { reason: string; location?: string; contact?: string }) {
  const { p12, password } = await seal();
  const doc = await PDFDocument.load(pdf);
  pdflibAddPlaceholder({
    pdfDoc: doc,
    reason: info.reason,
    contactInfo: info.contact ?? "buchhaltung@grid-agency.de",
    name: "GRID AGENCY UG",
    location: info.location ?? "Frankfurt am Main",
    signatureLength: 16384,
  });
  const withPlaceholder = Buffer.from(await doc.save({ useObjectStreams: false }));
  return new SignPdf().sign(withPlaceholder, new P12Signer(Buffer.from(p12, "base64"), { passphrase: password }));
}
