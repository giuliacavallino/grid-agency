import { redeemLogin, sessionCookie } from "@/lib/server/portal";

/** Anmeldelink aus der Mail: Sitzung setzen und zum Portal */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await redeemLogin(url.searchParams.get("token") ?? "").catch((error) => {
    console.error("Portal-Link:", error);
    return null;
  });
  const target = new URL(result ? "/portal" : "/portal?link=ungueltig", url.origin);
  return new Response(null, { status: 303, headers: { Location: target.toString(), ...(result ? { "Set-Cookie": sessionCookie(result.session) } : {}) } });
}
