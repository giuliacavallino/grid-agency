import { NextResponse, type NextRequest } from "next/server";

// sign.grid-agency.de zeigt nur die Unterschriftsseiten (/s/…), die
// Terminwahl für Bewerber*innen (/t/…) und ihre APIs; alles andere geht auf
// die Website. meet.grid-agency.de (Video-Calls) ist noch im Aufbau und
// leitet bis dahin ebenfalls weiter. Das Intranet bleibt unter seiner Domain.
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("meet.")) return NextResponse.redirect("https://grid-agency.de", 307);
  if (!host.startsWith("sign.")) return NextResponse.next();
  const { pathname } = request.nextUrl;
  const allowed = ["/s/", "/api/sign/", "/t/", "/api/termin/"];
  if (allowed.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();
  return NextResponse.redirect("https://grid-agency.de", 307);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|assets/).*)"],
};
