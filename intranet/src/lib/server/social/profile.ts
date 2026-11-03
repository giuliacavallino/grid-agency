import "server-only";
import { DEMO } from "@/lib/config";
import { PROVIDERS, type PostProvider, type ProfilePost, type ProfileResponse, type Workspace } from "@/lib/marketing";
import { readLinkedin } from "./linkedin";
import { readFacebook, readInstagram, type ProfileRead } from "./meta";
import { readTiktok } from "./tiktok";
import { listAccounts, type AccountRow } from "./store";

// Aktuelles Profil eines Kanals für das Cockpit: mit Verbindung live von der
// Plattform (nichts wird gespeichert), sonst nur der hinterlegte Link.

const READERS: Record<PostProvider, (account: AccountRow) => Promise<ProfileRead>> = {
  instagram: readInstagram,
  facebook: readFacebook,
  tiktok: readTiktok,
  linkedin: readLinkedin,
};

export async function channelProfile(workspace: Workspace, provider: PostProvider): Promise<ProfileResponse> {
  const accounts = await listAccounts(workspace.id);
  const account = accounts.find((a) => a.provider === provider && a.status === "active");
  const stored = workspace.profiles[provider] ?? null;
  if (!account) return { connected: false, url: stored };
  if (DEMO) return demoProfile(workspace, provider, account, stored);
  try {
    const { profile, posts, error } = await READERS[provider](account);
    return { connected: true, url: profile.url ?? stored, profile, posts, error };
  } catch (error) {
    // Zugang abgelaufen o. Ä.: zeigen, was ohne Plattform bekannt ist
    return {
      connected: true,
      url: stored,
      profile: { name: account.name, handle: account.handle, avatar: account.avatar_url, url: stored },
      posts: [],
      error: `${PROVIDERS[provider].label} antwortet nicht: ${error instanceof Error ? error.message : "unbekannter Fehler"}`,
    };
  }
}

// ---------- Vorschau (DEMO) ----------

const svg = (body: string, size = 600) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${body}</svg>`)}`;

const escapeXml = (text: string) => text.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

const DEMO_POSTS: { title: string; caption: string; type: ProfilePost["type"]; hue: number }[] = [
  { title: "Neu bei uns", caption: "Ab heute neu im Sortiment. Kommt vorbei und probiert!", type: "image", hue: 0 },
  { title: "Hinter den Kulissen", caption: "Um 4 Uhr geht es los: so sieht unser Morgen aus.", type: "video", hue: 28 },
  { title: "Angebot der Woche", caption: "Diese Woche zum Sonderpreis. Nur solange der Vorrat reicht.", type: "carousel", hue: -24 },
  { title: "Unser Team", caption: "Das sind die Menschen hinter jedem Tag bei uns.", type: "image", hue: 48 },
  { title: "Tipp der Woche", caption: "Unser Tipp für das Wochenende, in 30 Sekunden erklärt.", type: "video", hue: -48 },
  { title: "Danke!", caption: "1.000 Follower. Danke, dass ihr dabei seid!", type: "image", hue: 14 },
  { title: "So entsteht's", caption: "Von der Zutat bis ins Regal: Schritt für Schritt.", type: "carousel", hue: -12 },
  { title: "Wochenende", caption: "Samstag bis 14 Uhr geöffnet. Wir freuen uns auf euch.", type: "image", hue: 36 },
  { title: "Frisch aus dem Ofen", caption: "Noch warm. Wer will?", type: "video", hue: -36 },
];

function demoImage(color: string, title: string, hue: number, index: number) {
  const a = /^#[0-9a-f]{6}$/i.test(color) ? color : "#afaaa0";
  const b = `hsl(${(hue * 3 + index * 40 + 360) % 360} 55% 30%)`;
  return svg(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
      `<rect width="600" height="600" fill="url(#g)"/>` +
      `<circle cx="${120 + ((index * 97) % 360)}" cy="${140 + ((index * 61) % 300)}" r="${90 + ((index * 23) % 80)}" fill="#fff" fill-opacity="0.14"/>` +
      `<text x="44" y="96" font-family="Helvetica, Arial, sans-serif" font-size="50" font-weight="700" fill="#fff">${escapeXml(title)}</text>`
  );
}

function demoAvatar(workspace: Workspace) {
  if (workspace.avatar_url) return workspace.avatar_url;
  const initials = workspace.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return svg(`<rect width="200" height="200" fill="${workspace.color}"/><text x="100" y="124" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="72" font-weight="700" fill="#fff">${escapeXml(initials)}</text>`, 200);
}

function demoProfile(workspace: Workspace, provider: PostProvider, account: AccountRow, stored: string | null): ProfileResponse {
  const slug = workspace.name.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "");
  const handle = account.handle ?? (provider === "linkedin" ? slug : `@${slug}`);
  const bare = handle.replace(/^@/, "");
  const url =
    provider === "instagram"
      ? `https://www.instagram.com/${bare}/`
      : provider === "tiktok"
        ? `https://www.tiktok.com/@${bare}`
        : provider === "facebook"
          ? `https://www.facebook.com/${bare}`
          : `https://www.linkedin.com/company/${bare}/`;
  const scale = { instagram: 1, tiktok: 3.4, facebook: 0.6, linkedin: 0.2 }[provider];
  const now = Date.now();
  const posts: ProfilePost[] = DEMO_POSTS.map((p, index) => ({
    id: `demo-${provider}-${index}`,
    image: demoImage(workspace.color, p.title, p.hue, index),
    caption: p.caption,
    url,
    date: new Date(now - (index * 2 + 1) * 86_400_000).toISOString(),
    type: provider === "tiktok" ? "video" : p.type,
    likes: Math.round((40 + ((index * 37) % 180)) * scale),
    comments: Math.round((2 + ((index * 7) % 24)) * scale),
  }));
  return {
    connected: true,
    url: url || stored,
    profile: {
      name: workspace.name,
      handle,
      avatar: demoAvatar(workspace),
      followers: Math.round(2480 * scale),
      following: provider === "linkedin" || provider === "facebook" ? undefined : 312,
      posts: provider === "linkedin" ? undefined : 148,
      bio: `${workspace.name}: Handwerk mit Herz seit 1998.\nMo–Sa ab 6 Uhr geöffnet.\nwww.${slug}.de`,
      url,
    },
    posts,
  };
}
