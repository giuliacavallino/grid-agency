"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  BarChart3,
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ClientPost = {
  id: string;
  client: string;
  handle: string;
  caption: string;
  emoji: string;
  accent: string;
  media_url: string | null;
  likes: number;
  comments: number;
  reach: number;
  engagement_rate: number;
  posted_at: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "vor 1 Tag" : `vor ${days} Tagen`;
}

function InsightsPanel({ post }: { post: ClientPost }) {
  const interactions = post.likes + post.comments;
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="glass mt-3 rounded-2xl p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-dune">
          Insights — betreut von GRID
        </p>
        <div className="mt-3 flex justify-between">
          <div className="text-center">
            <p className="text-lg font-medium text-snow">
              {post.reach.toLocaleString("de-DE")}
            </p>
            <p className="text-[11px] font-light text-snow/50">Reichweite</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-snow">
              {interactions.toLocaleString("de-DE")}
            </p>
            <p className="text-[11px] font-light text-snow/50">
              Interaktionen
            </p>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-dune">
              {post.engagement_rate.toString().replace(".", ",")}%
            </p>
            <p className="text-[11px] font-light text-snow/50">Engagement</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PostCard({ post, isNew }: { post: ClientPost; isNew: boolean }) {
  const [liked, setLiked] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  return (
    <motion.article
      layout
      initial={isNew ? { opacity: 0, y: -32, scale: 0.97 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileInView={isNew ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="border-b border-snow/10 pb-5 pt-3"
    >
      {/* Header — close to the IG original */}
      <div className="flex items-center gap-2.5 px-1 py-2">
        <span className="story-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-[2px]">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-sky text-base">
            {post.emoji}
          </span>
        </span>
        <div className="min-w-0 leading-tight">
          <p className="flex items-center gap-1 truncate text-sm font-medium text-snow">
            {post.handle}
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-dune" strokeWidth={2} />
          </p>
          <p className="text-[11px] font-light text-snow/50">
            betreut von <span className="text-dune">grid.berlin</span>
          </p>
        </div>
        <MoreHorizontal className="ml-auto h-5 w-5 shrink-0 text-snow/60" />
      </div>

      {/* Media */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl">
        <span
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 120% at 30% 20%, ${post.accent}, var(--color-sky) 80%)`,
          }}
        />
        <span className="grid-pattern-bg absolute inset-0 opacity-15" />
        <span className="absolute inset-0 flex items-center justify-center text-7xl drop-shadow-lg">
          {post.emoji}
        </span>
        <span className="absolute bottom-3 left-3 rounded-full bg-sky/60 px-2.5 py-1 text-[10px] font-light tracking-wide text-snow/80 backdrop-blur-sm">
          {post.client}
        </span>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-4 px-1 pt-3">
        <button
          onClick={() => setLiked(!liked)}
          aria-label={liked ? "Gefällt mir nicht mehr" : "Gefällt mir"}
          className="transition-transform active:scale-90"
        >
          <Heart
            className={liked ? "fill-dune text-dune" : "text-snow"}
            strokeWidth={1.8}
          />
        </button>
        <MessageCircle className="text-snow" strokeWidth={1.8} />
        <Send className="text-snow" strokeWidth={1.8} />
        <button
          onClick={() => setShowInsights(!showInsights)}
          aria-label="Insights anzeigen"
          className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all active:scale-95 ${
            showInsights ? "bg-snow text-sky" : "glass text-snow"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" strokeWidth={2} />
          Insights
        </button>
        <Bookmark className="text-snow" strokeWidth={1.8} />
      </div>

      {/* Meta */}
      <div className="px-1 pt-2">
        <p className="text-sm font-medium text-snow">
          {(post.likes + (liked ? 1 : 0)).toLocaleString("de-DE")} &bdquo;Gef&auml;llt mir&ldquo;
        </p>
        <p className="mt-1 text-sm font-light leading-snug text-snow/80">
          <span className="font-medium text-snow">{post.handle}</span>{" "}
          {post.caption}
        </p>
        <p className="mt-1 text-sm font-light text-snow/45">
          Alle {post.comments} Kommentare ansehen
        </p>
        <p className="mt-1 text-[11px] font-light uppercase tracking-wide text-snow/35">
          {timeAgo(post.posted_at)}
        </p>
        <AnimatePresence>
          {showInsights && <InsightsPanel post={post} />}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

export function LiveFeedSection() {
  const [posts, setPosts] = useState<ClientPost[] | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("client_posts")
      .select("*")
      .order("posted_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!cancelled && data) setPosts(data as ClientPost[]);
      });

    const channel = supabase
      .channel("client_posts_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "client_posts" },
        (payload) => {
          const post = payload.new as ClientPost;
          setNewIds((prev) => new Set(prev).add(post.id));
          setPosts((prev) => (prev ? [post, ...prev] : [post]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-dune">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-dune opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-dune" />
          </span>
          Live aus unseren Kundenaccounts
        </p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Unsere Arbeit.
          <br />
          <span className="text-scroll-gradient">In Echtzeit</span>.
        </h2>
        <p className="mt-2 text-sm font-light text-snow/55">
          Neue Posts unserer Kunden erscheinen hier automatisch — ungefiltert,
          direkt aus dem Feed. Tipp auf „Insights&ldquo; für echte Zahlen.
        </p>
      </motion.div>

      <div className="mt-4">
        {posts === null ? (
          // Loading skeleton
          <div className="space-y-6 pt-4">
            {[0, 1].map((i) => (
              <div key={i}>
                <div className="flex items-center gap-2.5 py-2">
                  <div className="skeleton h-9 w-9 rounded-full" />
                  <div className="skeleton h-3 w-32 rounded" />
                </div>
                <div className="skeleton aspect-square w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} isNew={newIds.has(post.id)} />
          ))
        )}
      </div>
    </div>
  );
}
