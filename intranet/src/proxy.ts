import { NextResponse, type NextRequest } from "next/server";

// sign.grid-agency.de zeigt nur die Unterschriftsseiten (/s/…), die
// Terminwahl für Bewerber*innen (/t/…) und ihre APIs; meet.grid-agency.de
// nur die Video-Calls (meet.grid-agency.de/abc-defg-hjk → /m/…) und deren
// API. Alles andere geht auf die Website. Das Intranet bleibt unter seiner
// Domain.
const MEET_CODE = /^\/[a-z2-9]{3}-[a-z2-9]{4}-[a-z2-9]{3}$/;

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;
  if (host.startsWith("meet.")) {
    if (MEET_CODE.test(pathname)) return NextResponse.rewrite(new URL(`/m${pathname}`, request.url));
    if (pathname.startsWith("/api/meet/")) return NextResponse.next();
    return NextResponse.redirect("https://grid-agency.de", 307);
  }
  if (!host.startsWith("sign.")) return NextResponse.next();
  const allowed = ["/s/", "/api/sign/", "/t/", "/api/termin/"];
  if (allowed.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();
  return NextResponse.redirect("https://grid-agency.de", 307);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|assets/).*)"],
};
