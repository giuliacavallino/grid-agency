import { withUser } from "@/lib/server/auth";
import { banks, BankError } from "@/lib/server/enable-banking";

/** Banken in Deutschland für „Konto verbinden“ */
export const GET = withUser(async () => {
  try {
    return Response.json(await banks());
  } catch (error) {
    if (error instanceof BankError) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
}, ["admin"]);
