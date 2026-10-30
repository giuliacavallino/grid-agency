import { NextResponse, type NextRequest } from "next/server";

// sign.grid-agency.de zeigt nur die Unterschriftsseiten (/s/…) und ihre API;
// alles andere geht auf die Website. Das Intranet bleibt unter seiner Domain.
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (!host.startsWith("sign.")) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/s/") || pathname.startsWith("/api/sign/")) return NextResponse.next();
  return NextResponse.redirect("https://grid-agency.de", 307);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|assets/).*)"],
};
