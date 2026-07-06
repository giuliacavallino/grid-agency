"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { serviceStories } from "@/lib/content";
import { StoryViewer } from "./StoryViewer";

export function StoriesBar() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  return (
    <>
      <div className="no-scrollbar mt-6 flex gap-4 overflow-x-auto px-4 pb-2">
        {serviceStories.map((story, i) => {
          const isSeen = seen.has(story.id);
          return (
            <motion.button
              key={story.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.07, duration: 0.4 }}
              onClick={() => setOpenIndex(i)}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              <span
                className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-full p-[3px] ${
                  isSeen ? "bg-snow/20" : "story-ring"
                }`}
              >
                <span className="flex h-full w-full items-center justify-center rounded-full bg-sky text-2xl">
                  {story.emoji}
                </span>
              </span>
              <span className="text-[11px] font-light text-snow/80">
                {story.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      <StoryViewer
        openIndex={openIndex}
        onClose={(viewedId) => {
          if (viewedId) {
            setSeen((prev) => new Set(prev).add(viewedId));
          }
          setOpenIndex(null);
        }}
        onNavigate={(nextIndex, viewedId) => {
          setSeen((prev) => new Set(prev).add(viewedId));
          setOpenIndex(nextIndex);
        }}
      />
    </>
  );
}
