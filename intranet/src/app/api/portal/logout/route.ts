import { endSession, sessionCookie } from "@/lib/server/portal";

export async function POST(request: Request) {
  await endSession(request);
  return new Response(null, { status: 204, headers: { "Set-Cookie": sessionCookie("", 0) } });
}
