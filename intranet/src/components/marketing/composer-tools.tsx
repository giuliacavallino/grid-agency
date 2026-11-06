"use client";

import { useMemo, useState } from "react";
import { Download, Hash, Plus, Smile, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import type { Brand, PostProvider, SocialPost } from "@/lib/marketing";
import { Popover, Spinner, useToast } from "@/components/ui";
import { postsUrl } from "./post-editor";
import { URL_WORKSPACES } from "./workspace";

// Werkzeuge im Textfeld des Post-Editors (wie bei Hootsuite): Emoji-Auswahl,
// Hashtags (CI, zuletzt genutzt, KI-Vorschläge) und der Canva-Knopf.

const toolButton =
  "grid h-9 w-9 place-items-center rounded-full text-snow/70 transition-colors hover:bg-snow/[0.08] hover:text-snow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snow disabled:opacity-40";

// ---------- Emojis ----------

const EMOJIS: { label: string; items: string }[] = [
  { label: "Häufig", items: "😍 🥰 😊 😂 🤩 🙌 👏 🔥 ✨ 💯 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 👇 👉 ✅ 📍 📸 🎉" },
  { label: "Smileys", items: "😀 😃 😄 😁 😆 😅 🤣 🙂 😉 😇 😋 😎 🤗 🤭 🤔 🫶 😏 😌 😴 🥳 🤤 😮 😱 🥹 😢 😭 😤 🤯 🫠 🙃" },
  { label: "Gesten", items: "👍 👎 👌 ✌️ 🤞 🤟 🤙 👋 🙏 💪 🫵 ☝️ 👆 👈 🤝 ✍️ 💅 🫡" },
  { label: "Essen & Trinken", items: "🍕 🍝 🥐 🥖 🥨 🍞 🧁 🍰 🎂 🍩 🍪 🍫 🍦 🍓 🍋 🍅 🌶️ 🧀 🥗 🍔 🍟 🌭 🌮 🥙 🍣 🍜 🥟 ☕ 🍵 🍷 🍾 🥂 🍻 🍹 🧃" },
  { label: "Feiern & Anlässe", items: "🎉 🎊 🎁 🎈 🎄 🎅 🕯️ ⭐ 🌟 🎃 👻 🐣 🐰 💐 🌹 🌷 💝 💌 🏆 🥇 🎶 🎵 🎤 🎧 🎬" },
  { label: "Natur & Wetter", items: "☀️ 🌤️ 🌈 ☔ ❄️ ⛄ 🍂 🍁 🌸 🌻 🌿 🍀 🌊 🔆 🌙 ⚡" },
  { label: "Orte & Dinge", items: "📍 🏠 🏪 🏙️ ✈️ 🚗 🛍️ 🛒 💼 📅 ⏰ 📞 📲 💻 📢 📣 💡 🔔 🎯 🚀" },
  { label: "Symbole", items: "✅ ☑️ ❌ ⚠️ ❗ ❓ ➡️ ⬇️ ⬆️ 🔝 🆕 🆓 💥 💫 💬 🗓️ ♻️ ➕ 🔗 #️⃣ 1️⃣ 2️⃣ 3️⃣" },
];

const RECENT_KEY = "intranet:emoji-recent";
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
};

export function EmojiPicker({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const [recent, setRecent] = useState<string[]>([]);
  const groups = recent.length ? [{ label: "Zuletzt", items: recent.join(" ") }, ...EMOJIS] : EMOJIS;
  const pick = (emoji: string) => {
    onPick(emoji);
    const next = [emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, 16);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ohne Speicher eben ohne „Zuletzt“ */
    }
  };
  return (
    <Popover
      align="right"
      className="w-[min(340px,90vw)] p-2"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-label="Emoji einfügen"
          title="Emoji einfügen"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            if (!open) setRecent(readRecent());
            toggle();
          }}
          className={clsx(toolButton, open && "bg-snow/[0.1] text-snow")}
        >
          <Smile className="h-[19px] w-[19px]" />
        </button>
      )}
    >
      {() => (
        <div className="max-h-72 overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group.label} className="mb-1.5">
              <p className="px-1.5 pt-1 pb-1 text-[11px] font-medium tracking-wide text-snow/45 uppercase">{group.label}</p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.items.split(" ").map((emoji, i) => (
                  <button key={`${emoji}-${i}`} type="button" onClick={() => pick(emoji)} className="grid h-9 place-items-center rounded-lg text-[20px] hover:bg-snow/[0.08]" aria-label={emoji}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}

// ---------- Hashtags ----------

const TAG = /#[\p{L}\p{N}_]+/gu;
const hasTag = (caption: string, tag: string) => new RegExp(`(^|\\s)${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}_])`, "iu").test(caption);

/** Hashtag anhängen (eigene Zeile für den Hashtag-Block) oder wieder entfernen */
export function toggleTag(caption: string, tag: string) {
  if (hasTag(caption, tag)) {
    return caption
      .replace(new RegExp(`(^|\\s)${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}_])`, "giu"), "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+$/gm, "")
      .trimEnd();
  }
  const trimmed = caption.trimEnd();
  const lastLine = trimmed.split("\n").pop() ?? "";
  const tagLine = lastLine.trim().length > 0 && lastLine.trim().split(/\s+/).every((w) => w.startsWith("#"));
  if (!trimmed) return tag;
  return tagLine ? `${trimmed} ${tag}` : `${trimmed}\n\n${tag}`;
}

export function HashtagPicker({
  workspaceId,
  caption,
  platforms,
  onCaption,
  disabled,
}: {
  workspaceId: string;
  caption: string;
  platforms: PostProvider[];
  onCaption: (caption: string) => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const brand = useResource<{ brand: Brand }>(open ? `${URL_WORKSPACES}/${workspaceId}/brand` : null);
  const posts = useResource<SocialPost[]>(open ? postsUrl(workspaceId) : null);
  const [ai, setAi] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [own, setOwn] = useState("");

  // Zuletzt genutzt: Hashtags aus den bisherigen Posts, häufigste zuerst
  const recent = useMemo(() => {
    const count = new Map<string, number>();
    for (const post of posts.data ?? []) for (const tag of post.caption.match(TAG) ?? []) count.set(tag, (count.get(tag) ?? 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1]).map(([tag]) => tag).slice(0, 18);
  }, [posts.data]);
  const brandTags = brand.data?.brand.hashtags ?? [];
  const used = caption.match(TAG)?.length ?? 0;

  async function suggest() {
    setBusy(true);
    try {
      const result = await api<{ hashtags?: string[] }>("/api/marketing/assist", {
        method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId, action: "hashtags", caption, platforms: platforms.length ? platforms : ["instagram"] }),
      });
      setAi(result.hashtags ?? []);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Keine Vorschläge", "error");
    }
    setBusy(false);
  }

  const chip = (tag: string) => {
    const on = hasTag(caption, tag);
    return (
      <button
        key={tag}
        type="button"
        aria-pressed={on}
        onClick={() => onCaption(toggleTag(caption, tag))}
        className={clsx("h-7 rounded-full px-2.5 text-[12.5px] font-medium transition-colors", on ? "bg-snow text-sky" : "bg-snow/[0.07] text-snow/80 hover:bg-snow/[0.12]")}
      >
        {tag}
      </button>
    );
  };
  const section = (title: string, tags: string[], empty: string) => (
    <div className="mb-3">
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-snow/45 uppercase">{title}</p>
      {tags.length ? <div className="flex flex-wrap gap-1.5">{tags.map(chip)}</div> : <p className="text-[12px] text-snow/45">{empty}</p>}
    </div>
  );

  return (
    <Popover
      align="right"
      className="w-[min(380px,92vw)] p-3"
      trigger={({ open: isOpen, toggle }) => (
        <button
          type="button"
          aria-label="Hashtags"
          title="Hashtags"
          aria-expanded={isOpen}
          disabled={disabled}
          onClick={() => {
            setOpen(true);
            toggle();
          }}
          className={clsx(toolButton, isOpen && "bg-snow/[0.1] text-snow")}
        >
          <Hash className="h-[19px] w-[19px]" />
        </button>
      )}
    >
      {() => (
        <div className="max-h-[22rem] overflow-y-auto">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[13.5px] font-semibold">Hashtags</p>
            <span className={clsx("text-[12px] tabular-nums", used > 5 && platforms.includes("instagram") ? "text-[#d9822b]" : "text-snow/50")} title="Instagram empfiehlt 3–5 Hashtags">
              {used} im Text
            </span>
          </div>
          {brand.loading || posts.loading ? (
            <div className="grid place-items-center py-6">
              <Spinner />
            </div>
          ) : (
            <>
              {section("Aus dem Markenkit", brandTags, "Im Markenkit sind noch keine Hashtags hinterlegt.")}
              {section("Zuletzt genutzt", recent.filter((t) => !brandTags.includes(t)), "Noch keine Hashtags in bisherigen Posts.")}
              {ai && section("Vorschläge von Claude", ai, "Keine weiteren Vorschläge.")}
            </>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-snow/[0.08] pt-3">
            <button
              type="button"
              onClick={suggest}
              disabled={busy}
              aria-busy={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-snow/[0.07] px-3 text-[12.5px] font-medium hover:bg-snow/[0.12] disabled:opacity-60"
            >
              {busy ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy ? "Claude sucht …" : "Mit KI vorschlagen"}
            </button>
            <form
              className="flex min-w-0 flex-1 items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const tag = `#${own.trim().replace(/^#/, "").replace(/\s+/g, "")}`;
                if (tag.length > 1 && !hasTag(caption, tag)) onCaption(toggleTag(caption, tag));
                setOwn("");
              }}
            >
              <input
                value={own}
                onChange={(e) => setOwn(e.target.value)}
                placeholder="#eigener"
                aria-label="Eigenen Hashtag hinzufügen"
                className="h-8 min-w-0 flex-1 rounded-full border border-snow/10 bg-surface px-3 text-[12.5px] outline-none focus:border-snow/30"
              />
              <button type="submit" aria-label="Hashtag hinzufügen" className="grid h-8 w-8 place-items-center rounded-full hover:bg-snow/[0.08]">
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </Popover>
  );
}

// ---------- Canva ----------

/** Canva-Knopf wie bei Hootsuite: KI-Design in der CI oder aus Canva importieren */
export function CanvaButton({ ready, connected, onAi, onImport }: { ready: boolean; connected: boolean; onAi: () => void; onImport: () => void }) {
  return (
    <Popover
      align="right"
      side="top"
      className="w-64 p-1.5"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Canva"
          title={ready ? "Canva" : "Canva ist noch nicht verbunden"}
          disabled={!ready}
          className="grid h-11 w-11 place-items-center rounded-full text-[22px] font-semibold text-white italic shadow-[0_2px_8px_var(--shadow-color)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snow disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #00c4cc 0%, #5a32fa 60%, #7d2ae8 100%)", fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          C
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => {
              close();
              onAi();
            }}
            className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-snow/[0.06]"
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="block text-[13.5px] font-medium">Mit KI in Canva gestalten</span>
              <span className="block text-[12px] text-snow/55">Grafik in der CI, landet im Kundenordner</span>
            </span>
          </button>
          <button
            type="button"
            disabled={!connected}
            onClick={() => {
              close();
              onImport();
            }}
            className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-snow/[0.06] disabled:opacity-50"
          >
            <Download className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="block text-[13.5px] font-medium">Aus Canva importieren</span>
              <span className="block text-[12px] text-snow/55">Vorhandenes Design als Bild oder Video</span>
            </span>
          </button>
        </div>
      )}
    </Popover>
  );
}
