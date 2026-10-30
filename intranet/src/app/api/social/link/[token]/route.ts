import { configured } from "@/lib/server/social/connect";
import { listAccounts, resolveConnectLink } from "@/lib/server/social/store";

type Context = { params: Promise<{ token: string }> };

/** Öffentliche Verbindungsseite für Kunden: Name der Kundenwelt und was schon verbunden ist */
export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const workspace = await resolveConnectLink(token);
  if (!workspace) return Response.json({ error: "Der Link ist abgelaufen oder ungültig. Bitte bei GRID einen neuen anfordern." }, { status: 404 });
  const accounts = await listAccounts(workspace.id);
  const { meta, linkedin, tiktok } = configured();
  const providers = { meta, linkedin, tiktok };
  return Response.json(
    {
      workspace: { name: workspace.name, color: workspace.color, secondary_color: workspace.secondary_color, logo_url: workspace.logo_url },
      accounts: accounts.map((a) => ({ provider: a.provider, name: a.name, handle: a.handle, avatar_url: a.avatar_url, status: a.status })),
      configured: providers,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
