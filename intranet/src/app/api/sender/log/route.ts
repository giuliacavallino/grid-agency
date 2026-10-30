import { withUser } from "@/lib/server/auth";
import { listLog } from "@/lib/server/updates";

export const GET = withUser(async () => Response.json(await listLog()), ["admin"]);
