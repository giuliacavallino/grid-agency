import "server-only";
import { DEMO } from "@/lib/config";
import type { PostResult, Provider, SocialPost } from "@/lib/marketing";
import { withUrls } from "./media";
import { publishFacebook, publishInstagram, type PublishInput, type PublishOutput } from "./meta";
import { publishLinkedin } from "./linkedin";
import { publishTiktok } from "./tiktok";
import { claimPost, duePosts, getAccount, markAccountError, releaseStuck, resultEntry, updatePost, type AccountRow } from "./store";

// Veröffentlichen: ein Post geht an alle ausgewählten Kanäle seiner
// Kundenwelt. Pro Kanal wird das Ergebnis gespeichert; ein zweiter Versuch
// postet nur noch dort, wo es vorher nicht geklappt hat.

const PUBLISHERS: Partial<Record<Provider, (account: AccountRow, input: PublishInput) => Promise<PublishOutput>>> = {
  facebook: publishFacebook,
  instagram: publishInstagram,
  linkedin: publishLinkedin,
  tiktok: publishTiktok,
};

const demoPublish = async (account: AccountRow): Promise<PublishOutput> => ({ remote_id: `demo-${account.provider}-${Date.now()}` });

/** Post jetzt veröffentlichen. Nur aus Entwurf, Geplant, Teilweise oder Fehler. */
export async function publishPost(id: string, origin?: string): Promise<SocialPost> {
  const post = await claimPost(id, ["draft", "scheduled", "partial", "failed"]);
  if (!post) throw new Error("Post wird schon veröffentlicht oder ist bereits online");
  const results: Record<string, PostResult> = { ...post.results };
  const media = withUrls(post.media, origin).map((m) => ({ url: m.url!, kind: m.kind, mime: m.mime, path: m.path }));

  for (const accountId of post.account_ids) {
    if (results[accountId]?.status === "published") continue;
    const account = await getAccount(accountId);
    if (!account || account.workspace_id !== post.workspace_id) {
      results[accountId] = resultEntry({ status: "failed", error: "Kanal nicht (mehr) verbunden" });
      continue;
    }
    const publish = DEMO ? demoPublish : PUBLISHERS[account.provider];
    if (!publish) {
      results[accountId] = resultEntry({ status: "failed", error: `${account.provider} kann nicht posten` });
      continue;
    }
    try {
      const out = await publish(account, { caption: post.caption, media });
      results[accountId] = resultEntry({ status: "published", remote_id: out.remote_id, url: out.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Veröffentlichen fehlgeschlagen";
      results[accountId] = resultEntry({ status: "failed", error: message });
      // Abgelaufene Zugänge im Kanal markieren, damit die UI „neu verbinden“ zeigt
      if (/token|expired|abgelaufen|session|OAuth/i.test(message)) await markAccountError(account.id, message);
    }
  }

  const states = post.account_ids.map((a) => results[a]?.status);
  const ok = states.filter((s) => s === "published").length;
  const status = !post.account_ids.length ? "failed" : ok === states.length ? "published" : ok ? "partial" : "failed";
  return updatePost(post.id, { status, results, published_at: ok ? new Date().toISOString() : post.published_at });
}

/** Cron: alle fälligen geplanten Posts veröffentlichen */
export async function publishDue(now = new Date()) {
  await releaseStuck(now);
  const due = await duePosts(now);
  const done: { id: string; status: string }[] = [];
  for (const post of due) {
    try {
      const result = await publishPost(post.id);
      done.push({ id: post.id, status: result.status });
    } catch (error) {
      done.push({ id: post.id, status: error instanceof Error ? error.message : "Fehler" });
    }
  }
  return done;
}
