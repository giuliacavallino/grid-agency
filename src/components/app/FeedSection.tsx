"use client";

import { motion } from "framer-motion";
import { feedPosts } from "@/lib/content";
import { FeedPostCard } from "./FeedPostCard";

export function FeedSection() {
  return (
    <div className="px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Feed
        </p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-snow">
          Serving the coolest brands.
        </h2>
        <p className="mt-2 text-sm font-light text-snow/55">
          Doppeltipp auf einen Post. Du weißt, was passiert. 👆
        </p>
      </motion.div>

      <div className="mt-6">
        {feedPosts.map((post, i) => (
          <FeedPostCard key={post.id} post={post} index={i} />
        ))}
      </div>
    </div>
  );
}
