// Agenturvertrag der Unterschriftsmappe. Text aus den easybill-Aufträgen
// (Stand 2026) übernommen; kundenbezogene Stellen sind Platzhalter, die beim
// Versand ausgefüllt und mit der Mappe festgehalten werden.

export type ContractSection = { heading: string; body: string };

export type ContractTemplate = { title: string; sections: ContractSection[] };

/** Werte je Mappe */
export type ContractTerms = {
  /** Ziel der Zusammenarbeit (Präambel), z. B. „… auf Social Media“ */
  purpose: string;
  start_date: string;
  min_term_months: number;
  notice_months: number;
};

/** Vertrag, wie er mit der Mappe verschickt wurde */
export type ContractSnapshot = ContractTemplate & { terms: ContractTerms };

export const DEFAULT_PURPOSE =
  "die Optimierung und Erweiterung des werblichen und kommunikativen Auftritts des Unternehmens des Kunden, seiner Produkte und/oder Dienstleistungen auf Social Media";

export const DEFAULT_CONTRACT: ContractTemplate = {
  title: "Agenturvertrag",
  sections: [
    {
      heading: "Präambel",
      body: "Ziel der Zusammenarbeit zwischen dem Kunden und der Agentur ist {Zweck}. Zur Erreichung dieses Zieles sehen sich beide Vertragspartner in einem gegenseitigen Vertrauensverhältnis verbunden und vereinbaren Folgendes:",
    },
    {
      heading: "§1 Auftrag",
      body: "Der Kunde beauftragt die Agentur mit der werblichen und kommunikativen Betreuung im Umfang der unter §3 aufgeführten Leistungen.\nDie vorstehenden Produkte, Dienstleistungen und das Unternehmen werden nachfolgend zusammenfassend kurz als „Produkte“ bezeichnet. Die Agentur nimmt diesen Auftrag an und sichert dem Kunden engste Zusammenarbeit und jederzeitige Wahrung seiner Interessen zu.",
    },
    {
      heading: "§2 Grundsätze der Zusammenarbeit",
      body: "Die Agentur erbringt die vertragsgegenständlichen Leistungen sach-, termin- und fachgerecht entsprechend der vereinbarten Anforderungen und Qualitätskriterien oder – sofern dazu nichts vereinbart ist – nach den Grundsätzen ordnungsgemäßer Berufsausübung.\nDie Vertragsparteien verständigen sich in regelmäßigen Abständen über Fortschritte und Hindernisse bei der Durchführung der beauftragten Leistungen. Bei Abweichungen von dem vereinbarten Vorgehen oder Zweifeln an der Richtigkeit der Vorgehensweise des anderen unterrichten sie sich unverzüglich gegenseitig.\nEine rechtliche Prüfung der Leistungsergebnisse der Agentur, insbesondere nach dem Wettbewerbs-, Marken-, Urheber- und Persönlichkeitsrecht, ist ausdrücklich nicht Aufgabe der Agentur. Dasselbe gilt für die Durchführung und die rechtliche Auswertung von markenrechtlichen Recherchen und/oder für die Prüfung der Eintragungsfähigkeit von Marken und Designs/Geschmacksmuster.\nDie Agentur setzt zur Erfüllung ihrer Leistungspflichten qualifiziertes und zuverlässiges Personal ein. Die Agentur entscheidet nach eigenem, pflichtgemäßem Ermessen, welche Mitarbeiter zur vertragsgemäßen Leistungserbringung eingesetzt oder ausgetauscht werden. Die Agentur behält sich die Möglichkeit vor, einen Mitarbeiter aus einem wichtigen oder berechtigten Grund durch einen anderen Mitarbeiter mit der notwendigen Qualifikation zu ersetzen. Sie ist gegenüber ihren Mitarbeitern unabhängig von deren Einsatzort ausschließlich weisungsbefugt. Mitarbeiter der Agentur werden nicht in den Betrieb des Kunden eingegliedert und treten in kein Arbeitsverhältnis zum Kunden.\nDie Agentur ist hinsichtlich der Art der Durchführung der beauftragten Leistungen nach Zeit und Ort grundsätzlich frei.",
    },
    {
      heading: "§3 Leistungen der Agentur",
      body: "Die Leistungen der Agentur ergeben sich aus dem Angebot {Angebot} vom {Angebotsdatum}, das Bestandteil dieses Vertrags ist.",
    },
    {
      heading: "§4 Mitwirkung des Kunden",
      body: "Angaben zu Werbeaktivitäten und Budget: Der Kunde wird der Agentur jeweils vor dem neuen Geschäftsjahr den voraussichtlichen Geschäftsumfang im Hinblick auf die geplanten Werbeaktivitäten und das zur Verfügung stehende Budget mitteilen. Der Kunde wird der Agentur nicht unwesentliche Änderungen dieser mitgeteilten Planungen jeweils unverzüglich mitteilen.\nDer Kunde wird der Agentur alle für deren Arbeit erforderlichen oder dienlichen Daten und Informationen unaufgefordert zur Verfügung stellen. Die Agentur verpflichtet sich zur streng vertraulichen Behandlung solcher übermittelten Daten und Informationen.\nUnterstützungspflicht/Genehmigungen: Der Kunde wird die Agentur bei Erfüllung ihrer vertraglich geschuldeten Leistung in angemessenem Umfang unterstützen. Dazu gehört insbesondere die rechtzeitige Zurverfügungstellung von Informationen und Datenmaterial, soweit die Mitwirkungsleistungen des Kunden dies erfordern. Der Kunde wird Genehmigungen so rechtzeitig erteilen, dass der Arbeitsablauf der Agentur und damit die Realisierung der Werbemaßnahme nicht beeinträchtigt wird. Kann die Agentur die Leistungen wegen fehlender und unzureichender Mitwirkungsleistungen oder Beistellungen nicht oder nur mit Mehraufwendungen erbringen, ist sie berechtigt, hierdurch notwendige Mehraufwendungen gegenüber dem Kunden geltend zu machen.\nSollte der Agentur wegen fehlender Mitwirkung des Kunden die Leistungserbringung nicht möglich sein und erbringt der Kunde auch nach Mahnung unter Fristsetzung die erforderliche Mitwirkungshandlung nicht, kann die Agentur bis zur Erbringung der notwendigen Handlungen des Kunden ihre Leistung vorübergehend einstellen, ohne ihren Anspruch auf Vergütung zu verlieren.\nVerantwortlichkeit für Inhalte des Kunden: Sofern der Kunde der Agentur Materialien und/oder Inhalte (z. B. Markenlogos, Werbetexte, Produkte) überlässt, sichert er zu, dass diese frei von Rechten Dritter sind und deren Nutzung bzw. Veröffentlichung nicht in irgendeiner Form gegen geltendes Recht verstößt. Zu den überlassenen Inhalten gehören auch solche Inhalte und deren Quellen, die der Kunde der Agentur im Hinblick auf die Durchführung der beauftragten Leistungen empfiehlt oder vorschlägt. Sollte die Agentur aufgrund solcher vom Kunden stammenden Inhalte von Dritten in Anspruch genommen werden, stellt der Kunde die Agentur von diesen Ansprüchen (inklusive der notwendigen Rechtsverfolgungskosten) auf erstes Anfordern frei.",
    },
    {
      heading: "§5 Einsatz von Subunternehmern, Fremdleistungen",
      body: "Die Agentur hat das Recht, zur Erfüllung der beauftragten Leistungspflichten Subunternehmer oder freie Mitarbeiter (Dienstleister) einzusetzen. Diese gelten als Erfüllungsgehilfen (§ 278 BGB) der Agentur. Die von der Agentur beauftragten Dienstleister haben die in diesem Vertrag beschriebenen Verpflichtungen, die für die Agentur gelten, insbesondere die Geheimhaltung und den Datenschutz, ebenso einzuhalten und zu beachten.",
    },
    {
      heading: "§6 Vergütung der Agentur",
      body: "Vergütung: Für ihre Leistungen gemäß §3 erhält die Agentur die im Angebot {Angebot} genannte Vergütung zuzüglich der gesetzlichen Umsatzsteuer. Laufende monatliche Vergütungen gelten auf unbestimmte Zeit, sofern keine abweichende Vereinbarung in Textform getroffen wird.\nBarauslagen: Barauslagen und besondere Kosten, die der Agentur auf ausdrücklichen Wunsch des Kunden entstehen, werden zum Selbstkostenpreis berechnet. Hierzu zählen zum Beispiel außergewöhnliche Kommunikations-, Versand- oder Vervielfältigungskosten.\nReisekosten: Sofern die Agentur Leistungen im Einvernehmen mit dem Kunden außerhalb ihres Sitzes erbringt (zum Beispiel Fahrten zum Kunden), hat sie über die vereinbarte Vergütung hinaus Anspruch auf Erstattung der Reisekosten (Bahnfahrten der 2. Klasse, Flüge der Economy-Klasse oder Fahrten per Pkw mit 0,30 Euro/km netto) inklusive aller erforderlichen Auslagen, Aufwendungen und Spesen. Reisezeiten werden nach tatsächlichem Aufwand zum Stunden- bzw. Tagessatz abgerechnet.\nUmsatzsteuer: Sämtliche Vergütungen der Agentur verstehen sich zuzüglich der gesetzlich jeweils geltenden Umsatzsteuer. Bei Rechnungen an Leistungsempfänger außerhalb der Bundesrepublik Deutschland wird keine deutsche Umsatzsteuer berechnet und in den Rechnungen ausgewiesen. Auf diesen Rechnungen ist die vom Kunden zu benennende VAT-Nummer des Leistungsempfängers anzugeben.\nFälligkeit und Skonti: Die von der Agentur dem Kunden ausgestellten Rechnungen sind nach Erhalt und ohne Abzüge fällig. Bei größeren Aufträgen oder solchen, die sich über einen längeren Zeitraum erstrecken, ist die Agentur berechtigt, Zwischenabrechnungen beziehungsweise Vorausrechnungen zu erstellen oder Akontozahlungen abzurufen. Skonti auf Agenturvergütungen werden nicht gewährt.\nZahlungsweise: Erteilt der Kunde ein SEPA-Lastschriftmandat, zieht die Agentur fällige Rechnungen per Lastschrift ein. Die Vorabankündigung (Pre-Notification) erfolgt mit der Rechnung, spätestens einen Tag vor dem Einzug.",
    },
    {
      heading: "§7 Abruf von Agenturleistungen (Auftragsvergabe)",
      body: "Kostenvoranschläge: Vor Beginn jeder zusätzlichen kostenverursachenden Arbeit hat die Agentur dem Kunden einen Kostenvoranschlag in Textform zu unterbreiten.\nAuftragserteilung: Der Kunde erteilt den Auftrag an die Agentur durch Genehmigung des Kostenvoranschlags. Die Genehmigung soll in der Regel in Textform erfolgen. Erfolgt sie mündlich, so soll sie in einem Besprechungsprotokoll festgehalten werden.\nKleinere Einzelaufträge bis zu maximal 500 Euro netto sowie Aufträge im Rahmen laufender Arbeiten wie zum Beispiel Zwischenaufnahmen, Satzkosten, Retuschen und dergleichen bedürfen nicht der Vorlage von Kostenvoranschlägen und vorheriger Genehmigung durch den Kunden.",
    },
    {
      heading: "§8 Änderungen von Arbeiten (Change Request)",
      body: "Nachträgliche Änderungen der beauftragten Leistungen (Change Request) durch den Kunden sind der Agentur möglichst frühzeitig und hinreichend konkret mitzuteilen und benötigen zu deren Wirksamkeit einer ausdrücklichen Bestätigung durch die Agentur.\nIst bei Vorliegen einer nachträglichen Änderung der Leistungsbeschreibung die ursprünglich beauftragte Leistung nicht oder nur noch teilweise durchführbar, ist die Agentur berechtigt, die weitere Leistungserbringung einzustellen. Die Agentur wird dies dem Kunden mitteilen. Widerspricht der Kunde der Leistungseinstellung, so setzt die Agentur die ursprüngliche Leistungserbringung fort.\nSofern der Agentur durch den Change Request Mehrkosten entstehen, wird die Agentur den Kunden hierauf hinweisen. Die Agentur ist berechtigt, die Mehrleistungen dem Kunden in Rechnung zu stellen.",
    },
    {
      heading: "§9 Nutzungsrechte; Umfang und Vergütung",
      body: "Alle urheberrechtlichen und sonstigen Nutzungsrechte an den vom Kunden zur werblichen Verwendung freigegebenen und bezahlten Arbeitsergebnissen der Agentur gehen auf den Kunden über in dem Umfang, wie es der von beiden Vertragspartnern zu Grunde gelegte Zweck des jeweiligen Auftrages gemäß §3 erfordert. Im Zweifel erfüllt die Agentur ihre Verpflichtungen durch Einräumung ausschließlicher Nutzungsrechte im Gebiet der Bundesrepublik Deutschland für die von den Vertragsparteien jeweils in dem Auftrag vorgesehenen Medien und Einsatzdauer der Werbemaßnahme. Jede darüber hinausgehende Nutzung der Arbeitsergebnisse der Agentur bedarf der gesonderten Zustimmung der Agentur.\nDie Agentur ist – auch bei Übertragung ausschließlicher Nutzungsrechte auf den Kunden – berechtigt, die Arbeitsergebnisse im Rahmen ihrer Eigenwerbung unentgeltlich zu verwenden unter Nennung des Kundennamens, auch nach Vertragsende, in allen Medien einschließlich Internet, Social Media und im Rahmen von Wettbewerben und Präsentationen.\nNicht Gegenstand der Rechteübertragung auf den Kunden sind von diesem abgelehnte, abgebrochene oder nicht innerhalb von 6 Monaten nach Übergabe genutzte Leistungen der Agentur (Konzepte, Ideen, Entwürfe etc.). Diese Nutzungsrechte verbleiben bei der Agentur, ebenso die daran bestehenden Eigentumsrechte.\nDie vorstehend genannten Nutzungsrechte sind mit der Bezahlung der in §6 vereinbarten Vergütung abgegolten. Eine Ausdehnung der Nutzung über das Ende des Werbemitteleinsatzes und/oder über das Vertragsgebiet hinaus und/oder für den Einsatz in anderen als den im jeweiligen Auftrag genannten Nutzungsarten/Werbeträgern und/oder das Recht, die Arbeitsergebnisse der Agentur zu bearbeiten, bedarf der ausdrücklichen vorherigen Zustimmung der Agentur und muss gesondert vergütet werden.",
    },
    {
      heading: "§10 Haftung",
      body: "Die Haftung der Agentur und ihrer Vertreter und Erfüllungsgehilfen für leicht fahrlässige Pflichtverletzungen wird ausgeschlossen mit Ausnahme der Verletzung wesentlicher Vertragspflichten.\nDie Agentur übernimmt keine eigene rechtliche Überprüfung der von ihr erbrachten Leistungen. Erachtet die Agentur für die Realisierung der Maßnahmen eine rechtliche (z. B. wettbewerbs- oder markenrechtliche) Prüfung durch eine besonders sachkundige Person oder Institution für erforderlich, so trägt der Kunde nach Abstimmung die Kosten.",
    },
    {
      heading: "§11 Datenschutz",
      body: "Die Vertragspartner werden die gesetzlichen Vorschriften zum Datenschutz, insbesondere die Regelungen der DSGVO und des BDSG, beachten und ihre Mitarbeiter entsprechend verpflichten. Dies gilt insbesondere auch in Bezug auf die Verpflichtung der mit Datenverarbeitung befassten Personen auf das Datengeheimnis.",
    },
    {
      heading: "§12 Vertragsdauer",
      body: "Der Vertrag beginnt am {Vertragsbeginn}. Er wird mit einer Mindestlaufzeit von {Mindestlaufzeit} Monaten auf unbestimmte Zeit geschlossen und kann nach Ablauf der Mindestlaufzeit von beiden Parteien mit einer Frist von {Kündigungsfrist} Monaten zum Monatsende gekündigt werden.\nDie Kündigung hat in Textform zu erfolgen.",
    },
    {
      heading: "§13 Regelungen für das Vertragsende",
      body: "Soweit die Agentur Verpflichtungen gegenüber Dritten im Rahmen dieses Vertrages eingegangen ist (Festaufträge) und diese Verpflichtungen über das Ende dieses Vertrages zwischen der Agentur und dem Kunden hinaus andauern, ist der Kunde verpflichtet, die sich hieraus für ihn ergebenden Verpflichtungen auch nach Vertragsende unter Einschaltung der Agentur bis zum Beendigungszeitpunkt des zwischen der Agentur und dem Dritten bestehenden Vertrages zu erfüllen. Die Agentur ist verpflichtet, unverzüglich nach Kenntniserlangung vom Zeitpunkt der Beendigung des Vertrages mit dem Kunden auch den Vertrag mit dem Dritten zum frühestmöglichen Zeitpunkt zu beenden.\nSollte dem Kunden nach Vertragsbeendigung mit der Agentur eine Erfüllung seiner Pflichten aus dem zwischen der Agentur und dem Dritten geschlossenen Vertrag nicht mehr möglich sein, hat er der Agentur die Aufwendungen und den gegebenenfalls entstehenden Schaden zu ersetzen, die ihr dadurch entstehen, dass sie die Verpflichtungen gegenüber dem Dritten auch nach Beendigung des Vertrages mit dem Kunden erfüllen muss.",
    },
    {
      heading: "§14 Vertragsänderungen, Gerichtsstand",
      body: "Änderungen und Ergänzungen dieses Vertrages bedürfen für ihre Wirksamkeit der Schriftform. Die Schriftform wird auch durch die Textform nach § 126b BGB gewahrt (z. B. E-Mail). Das gilt auch, wenn in den zwischen den Parteien abgeschlossenen Aufträgen oder Verträgen eine „schriftliche“ Erklärung verlangt wird.\nDie Geltung allgemeiner Geschäftsbedingungen (AGB) beider Vertragsparteien wird ausgeschlossen.\nSollte eine Bestimmung dieses Vertrages unwirksam sein oder werden, so wird die Gültigkeit des Vertrages im Übrigen hiervon nicht berührt. An die Stelle der unwirksamen Bestimmung soll eine Regelung treten, die im Rahmen des rechtlich Möglichen dem Willen der Parteien am nächsten kommt.\nIm Falle von Streitigkeiten aus dem Abschluss, der Durchführung oder der Beendigung dieses Vertrages vereinbaren die Parteien als ausschließlichen Gerichtsstand den Sitz der Agentur. Auf den Vertrag findet ausschließlich deutsches Recht Anwendung. Die Vorschriften des UN-Kaufrechts werden ausgeschlossen.",
    },
  ],
};

const dateDe = (value: string | null | undefined) =>
  value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

/** Platzhalter im Vertrag ausfüllen */
export function fillContract(text: string, values: { terms: ContractTerms; offerNumber: string | null; offerDate: string | null }) {
  const map: Record<string, string> = {
    Zweck: values.terms.purpose,
    Angebot: values.offerNumber ?? "",
    Angebotsdatum: dateDe(values.offerDate),
    Vertragsbeginn: dateDe(values.terms.start_date),
    Mindestlaufzeit: String(values.terms.min_term_months),
    Kündigungsfrist: String(values.terms.notice_months),
  };
  return text.replace(/\{(\p{L}+)\}/gu, (match, key: string) => map[key] ?? match);
}

/** Template aus den Einstellungen als Text mit „## Überschrift“ je Abschnitt (zum Bearbeiten) */
export const contractToText = (template: ContractTemplate) => template.sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");

export function contractFromText(title: string, text: string): ContractTemplate {
  const sections = text
    .split(/^## /m)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [heading, ...body] = part.split("\n");
      return { heading: heading.trim(), body: body.join("\n").trim() };
    });
  return { title: title.trim() || "Agenturvertrag", sections };
}

/** SEPA-Lastschriftmandat (Basislastschrift, wiederkehrend) */
export const SEPA_TEXT =
  "Ich ermächtige / Wir ermächtigen {Gläubiger}, Zahlungen von meinem / unserem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein / weisen wir unser Kreditinstitut an, die von {Gläubiger} auf mein / unser Konto gezogenen Lastschriften einzulösen.\nHinweis: Ich kann / Wir können innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem / unserem Kreditinstitut vereinbarten Bedingungen.";

/** IBAN prüfen (Länge und Prüfziffer nach ISO 13616) */
export function validIban(value: string) {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("DE") && iban.length !== 22) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let rest = 0;
  for (const digit of digits) rest = (rest * 10 + Number(digit)) % 97;
  return rest === 1;
}

export const formatIban = (value: string) => value.replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();

/** Unterschriftsfelder der Mappe; jedes bekommt eine eigene Prüf-ID */
export type SignField = "angebot" | "vertrag" | "sepa";
export const SIGN_FIELD_LABEL: Record<SignField, string> = { angebot: "Annahme des Angebots", vertrag: "Agenturvertrag", sepa: "SEPA-Lastschriftmandat" };
export const signFields = (sepa: boolean): SignField[] => (sepa ? ["angebot", "vertrag", "sepa"] : ["angebot", "vertrag"]);

/** Prüf-ID wie 8F3A-1C2E-4B7D-90AF (64 Bit) */
export const VERIFY_ID = /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/;
export const formatVerifyId = (hex: string) => hex.slice(0, 16).toUpperCase().match(/.{4}/g)!.join("-");
