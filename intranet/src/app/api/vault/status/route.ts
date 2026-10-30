import { withUser } from "@/lib/server/auth";
import { vaultStatus } from "@/lib/server/vault";

/** Ob VAULT_KEY gesetzt und gültig ist (nie der Wert selbst) */
export const GET = withUser(async () => Response.json({ status: vaultStatus() }));
