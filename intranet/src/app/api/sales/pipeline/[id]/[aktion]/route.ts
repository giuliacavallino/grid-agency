import { withUser } from "@/lib/server/auth";
import { BillingError } from "@/lib/server/billing-write";
import { createOffer, FlowError, inviteLead, leadToPartner, markSpam, startOnboarding, type OfferInput } from "@/lib/server/lead-flow";
import { SignError } from "@/lib/server/sign";

// Aktionen an der Pipeline-Karte: zum Erstgespräch einladen, Angebot
// erstellen und als Unterschriftsmappe abschicken, Onboarding starten,
// Spam löschen (Absender wird gesperrt).

type Context = { params: Promise<{ id: string; aktion: string }> };

export const maxDuration = 60;

export const POST = withUser(async (user, request, { params }: Context) => {
  const { id, aktion } = await params;
  const who = { email: user.email, name: user.name };
  try {
    if (aktion === "einladen") return Response.json(await inviteLead(id, who));
    if (aktion === "angebot") return Response.json(await createOffer(id, (await request.json()) as OfferInput, who));
    if (aktion === "onboarding") return Response.json(await startOnboarding(id, who));
    if (aktion === "spam") return Response.json(await markSpam(id, who));
    if (aktion === "partner") return Response.json(await leadToPartner(id));
    return Response.json({ error: "Unbekannte Aktion" }, { status: 404 });
  } catch (error) {
    if (error instanceof FlowError || error instanceof BillingError || error instanceof SignError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}, ["sales"]);
