import { after } from "next/server";
import { saveAdLead } from "@/lib/server/ad-leads";
import { hmacHex, safeEqual } from "@/lib/server/signature";

export const maxDuration = 60;

const API = "https://api.linkedin.com/rest";
const VERSION = process.env.LINKEDIN_API_VERSION ?? "202509";

/** LinkedIn prüft die Webhook-URL mit einem challengeCode, den wir mit dem
 * Client-Secret signiert zurückgeben. */
export async function GET(request: Request) {
  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  const challengeCode = new URL(request.url).searchParams.get("challengeCode");
  if (!secret || !challengeCode) return new Response("Nicht erlaubt", { status: 403 });
  return Response.json({ challengeCode, challengeResponse: hmacHex(secret, challengeCode) });
}

async function linkedIn<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      "LinkedIn-Version": VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  if (!response.ok) throw new Error(`LinkedIn ${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

type FormResponse = {
  id?: string;
  submittedAt?: number;
  versionedLeadGenFormUrn?: string;
  formResponse?: {
    answers?: { questionId: number; answerDetails?: { textQuestionAnswer?: { answer?: string }; multipleChoiceAnswer?: { options?: number[] } } }[];
  };
};
type LeadForm = {
  name?: string;
  content?: { questions?: { questionId: number; name?: string; predefinedField?: string; question?: { localized?: Record<string, string> } }[] };
};

const PREDEFINED: Record<string, "name" | "email" | "phone" | "company"> = {
  EMAIL: "email",
  WORK_EMAIL: "email",
  PHONE_NUMBER: "phone",
  WORK_PHONE_NUMBER: "phone",
  COMPANY_NAME: "company",
};

const lastId = (urn: string) => urn.split(":").pop()!.replace(/[()]/g, "");

/** Lead-Sync-Benachrichtigung für LinkedIn-Lead-Gen-Formulare. */
export async function POST(request: Request) {
  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!secret || !process.env.LINKEDIN_ACCESS_TOKEN) return new Response("Nicht eingerichtet", { status: 503 });

  const raw = await request.text();
  const signature = request.headers.get("x-li-signature") ?? "";
  if (!safeEqual(signature, `hmacsha256=${hmacHex(secret, raw)}`)) {
    return new Response("Signatur ungültig", { status: 401 });
  }

  const event = JSON.parse(raw) as { leadGenFormResponse?: string; leadAction?: string };
  const responseUrn = event.leadGenFormResponse;
  if (!responseUrn || (event.leadAction && event.leadAction !== "CREATED")) return new Response("OK");

  after(async () => {
    try {
      const id = lastId(responseUrn);
      const form = await linkedIn<FormResponse>(`/leadFormResponses/${encodeURIComponent(id)}`);

      // Fragen des Formulars laden, um Antworten zuzuordnen
      const formUrn = form.versionedLeadGenFormUrn?.match(/urn:li:leadGenForm:(\d+)/)?.[1];
      const definition = formUrn ? await linkedIn<LeadForm>(`/leadForms/${formUrn}`).catch(() => null) : null;
      const questions = new Map((definition?.content?.questions ?? []).map((q) => [q.questionId, q]));

      const fields: Partial<Record<"name" | "email" | "phone" | "company", string>> = {};
      const answers = [];
      let first = "";
      let last = "";
      for (const answer of form.formResponse?.answers ?? []) {
        const value = answer.answerDetails?.textQuestionAnswer?.answer;
        if (!value) continue;
        const question = questions.get(answer.questionId);
        const predefined = question?.predefinedField ?? "";
        if (predefined === "FIRST_NAME") first = value;
        else if (predefined === "LAST_NAME") last = value;
        else if (PREDEFINED[predefined]) fields[PREDEFINED[predefined]] = value;
        else {
          const label = question?.question?.localized ? Object.values(question.question.localized)[0] : question?.name;
          answers.push({ label: label ?? `Frage ${answer.questionId}`, value });
        }
      }
      if (first || last) fields.name = [first, last].filter(Boolean).join(" ");

      await saveAdLead({
        source: "linkedin",
        ref: id,
        createdAt: form.submittedAt ? new Date(form.submittedAt).toISOString() : undefined,
        fields,
        answers,
        context: definition?.name ? `Formular: ${definition.name}` : undefined,
        raw: form,
      });
    } catch (error) {
      console.error("LinkedIn-Lead konnte nicht übernommen werden:", error);
    }
  });
  return new Response("OK");
}
