import { withUser } from "@/lib/server/auth";
import { senderChats } from "@/lib/server/sender";

export const GET = withUser(async () => Response.json(await senderChats()), ["admin"]);
