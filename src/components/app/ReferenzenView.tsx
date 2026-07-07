"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Camera, Heart, MessageCircle, X } from "lucide-react";
import { clients, clientSlug, type Client } from "@/lib/content";
import { stashScrollTarget } from "@/lib/scroll";
import { supabase } from "@/lib/supabase";

/** lucide dropped brand icons, so the Instagram glyph lives here. */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

type ClientPost = {
  id: string;
  client: string;
  handle: string;
  caption: string;
  emoji: string | null;
  accent: string | null;
  likes: number;
  comments: number;
  reach: number | null;
  posted_at: string;
};

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 1000));
  if (s < 3600) return `vor ${Math.max(1, Math.round(s / 60))} Min.`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
  if (s < 604800) return `vor ${Math.round(s / 86400)} Tagen`;
  return `vor ${Math.round(s / 604800)} Wochen`;
}

function PostCard({ post }: { post: ClientPost }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
          style={{ background: post.accent ?? "#676159" }}
        >
          {post.emoji ?? "✨"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-snow">
            @{post.handle}
          </p>
          <p className="text-[11px] font-light text-snow/45">
            {timeAgo(post.posted_at)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm font-light leading-relaxed text-snow/80">
        {post.caption}
      </p>
      <div className="mt-3 flex items-center gap-4 text-xs font-light text-snow/55">
        <span className="flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" strokeWidth={1.8} />
          {post.likes.toLocaleString("de-DE")}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
          {post.comments.toLocaleString("de-DE")}
        </span>
        {post.reach != null && (
          <span className="ml-auto">
            {post.reach.toLocaleString("de-DE")} erreicht
          </span>
        )}
      </div>
    </div>
  );
}

function ClientSheet({
  client,
  onClose,
}: {
  client: Client;
  onClose: () => void;
}) {
  const [posts, setPosts] = useState<ClientPost[] | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("client_posts")
      .select("*")
      .ilike("client", client.name)
      .order("posted_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (!cancelled) setPosts((data as ClientPost[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [client.name]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-sky/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 90 || info.velocity.y > 600) onClose();
        }}
        className="glass fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-snow/25" />

        <button
          aria-label="Schließen"
          onClick={onClose}
          className="glass absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-snow"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="flex min-h-20 items-center justify-center py-3">
          {client.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo}
              alt={client.name}
              style={{ height: Math.min((client.height ?? 32) * 1.5, 64) }}
              className="w-auto"
            />
          ) : (
            <span className="text-xl font-light uppercase tracking-[0.2em] text-snow/70">
              {client.name}
            </span>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-snow">
          {client.name}
          <BadgeCheck className="h-4 w-4 text-dune" strokeWidth={2} />
        </p>

        {client.intro && (
          <p className="mx-auto mt-3 max-w-[26rem] text-center text-sm font-light leading-relaxed text-snow/70">
            {client.intro}
          </p>
        )}

        {client.instagram && (
          <a
            href={`https://www.instagram.com/${client.instagram}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 btn-rainbow rounded-full bg-snow py-3 text-sm font-medium text-sky active:scale-[0.97]"
          >
            <InstagramIcon className="h-4 w-4" />
            @{client.instagram}
          </a>
        )}

        {client.caseStudy && (
          <div className="mt-7">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
              Der Case
            </p>
            <p className="mt-3 rounded-2xl bg-black p-4 text-sm font-light leading-relaxed text-snow/85">
              {client.caseStudy}
            </p>
          </div>
        )}

        <div className="mt-7">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
            Live-Feed
          </p>
          {posts === null ? (
            <div className="skeleton mt-3 h-28 rounded-2xl" />
          ) : posts.length > 0 ? (
            <div className="mt-3 space-y-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-snow/15 px-4 py-6 text-center text-xs font-light text-snow/40">
              Frische Posts landen hier, sobald sie live sind.
            </p>
          )}
        </div>

        <div className="mt-7">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
            Galerie
          </p>
          {client.gallery && client.gallery.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {client.gallery.slice(0, 6).map((src) => (
                <div
                  key={src}
                  className="relative aspect-square overflow-hidden rounded-xl"
                >
                  <Image
                    src={src}
                    alt={client.name}
                    fill
                    sizes="(max-width: 560px) 33vw, 180px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-snow/15 py-8">
              <Camera className="h-5 w-5 text-snow/30" strokeWidth={1.6} />
              <p className="text-xs font-light text-snow/40">
                Einblicke folgen in Kürze.
              </p>
            </div>
          )}
        </div>

        {(Boolean(client.gallery?.length) ||
          Boolean(client.sections?.length) ||
          Boolean(client.caseStudy)) && (
          <Link
            href={`/referenzen/${clientSlug(client.name)}`}
            className="mt-6 flex items-center justify-center gap-2 rounded-full border border-snow/15 bg-snow/5 py-3 text-sm font-medium text-snow transition-all active:scale-[0.97]"
          >
            {client.gallery && client.gallery.length > 6
              ? `Alle ${client.gallery.length} Bilder ansehen`
              : "Ganzen Case ansehen"}
            →
          </Link>
        )}
      </motion.div>
    </>
  );
}

export function ReferenzenView() {
  const [active, setActive] = useState<Client | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div className="px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
          Referenzen
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Marken, die uns
          <br />
          ihren <span className="text-scroll-gradient">Feed</span> anvertrauen.
        </h1>
        <p className="mt-3 max-w-[26rem] text-sm font-light leading-relaxed text-snow/60">
          {clients.length} Brands aus Berlin, Frankfurt und darüber hinaus.
          Tippe auf ein Logo für den Live-Feed und Einblicke.
        </p>
      </motion.div>

      {/* Standalone logos, no tiles: hover zooms, click opens the feed. */}
      <div className="mt-10 grid grid-cols-2 items-center gap-x-6 gap-y-10 sm:grid-cols-3">
        {clients.map((client, i) => (
          <motion.button
            key={client.name}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.5) }}
            onClick={() => setActive(client)}
            aria-label={client.name}
            className="group flex items-center justify-center p-2"
          >
            {client.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.logo}
                alt={client.name}
                style={{ height: Math.min((client.height ?? 32) * 1.2, 52) }}
                className="max-w-full w-auto object-contain opacity-90 transition-transform duration-300 ease-out group-hover:scale-110 group-active:scale-95"
                loading={i < 12 ? "eager" : "lazy"}
              />
            ) : (
              <span className="text-center text-xs font-light uppercase tracking-[0.15em] text-snow/50 transition-transform duration-300 group-hover:scale-110">
                {client.name}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      <p className="mt-12 text-center text-sm font-light text-snow/50">
        Deine Marke fehlt hier noch?{" "}
        <Link
          href="/"
          onClick={() => stashScrollTarget("dm")}
          className="font-medium text-dune underline-offset-4 hover:underline"
        >
          Lass uns reden →
        </Link>
      </p>

      {mounted && (
        <AnimatePresence>
          {active && (
            <ClientSheet client={active} onClose={() => setActive(null)} />
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
