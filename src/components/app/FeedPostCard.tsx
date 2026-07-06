"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import type { FeedPost } from "@/lib/content";

export function FeedPostCard({ post, index }: { post: FeedPost; index: number }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const [burst, setBurst] = useState(false);
  const lastTap = useRef(0);

  function like() {
    if (!liked) {
      setLiked(true);
      setLikes((n) => n + 1);
    }
    setBurst(true);
    window.setTimeout(() => setBurst(false), 700);
  }

  function toggleLike() {
    setLiked((prev) => {
      setLikes((n) => (prev ? n - 1 : n + 1));
      return !prev;
    });
  }

  function onTapImage() {
    const now = Date.now();
    if (now - lastTap.current < 280) like();
    lastTap.current = now;
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden border-b border-snow/10"
    >
      <div className="flex items-center gap-2.5 px-1 py-3">
        <span className="story-ring flex h-9 w-9 items-center justify-center rounded-full p-[2px]">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-sky text-base">
            {post.emoji}
          </span>
        </span>
        <div className="leading-tight">
          <p className="text-sm font-medium text-snow">{post.handle}</p>
          <p className="text-[11px] font-light text-snow/50">
            {post.brand} · Berlin
          </p>
        </div>
      </div>

      <button
        onClick={onTapImage}
        className="relative block aspect-square w-full select-none overflow-hidden rounded-xl"
        aria-label={`${post.brand} Post liken`}
      >
        <span
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 120% at 30% 20%, ${post.accent}, var(--color-sky) 78%)`,
          }}
        />
        <span className="grid-pattern-bg absolute inset-0 opacity-15" />
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="text-6xl drop-shadow-lg">{post.emoji}</span>
          <Image
            src="/brand/grid_monogram_snow.png"
            alt=""
            width={44}
            height={24}
            className="opacity-80"
          />
        </span>

        <AnimatePresence>
          {burst && (
            <motion.span
              initial={{ scale: 0, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 1.25, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Image
                src="/brand/grid_monogram_snow.png"
                alt=""
                width={130}
                height={72}
                className="drop-shadow-2xl"
              />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <div className="flex items-center gap-4 px-1 pt-3">
        <button
          onClick={toggleLike}
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
        <Bookmark className="ml-auto text-snow" strokeWidth={1.8} />
      </div>

      <div className="px-1 pb-4 pt-2">
        <p className="text-sm font-medium text-snow">
          {likes.toLocaleString("de-DE")} &bdquo;Gef&auml;llt mir&ldquo;
        </p>
        <p className="mt-1 text-sm font-light text-snow/80">
          <span className="font-medium text-snow">{post.handle}</span>{" "}
          {post.caption}
        </p>
        <p className="mt-1 text-sm font-light text-dune">
          {post.hashtags.map((h) => `#${h}`).join(" ")}
        </p>
      </div>
    </motion.article>
  );
}
