"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { serviceStories } from "@/lib/content";

const SLIDE_MS = 5000;

type StoryViewerProps = {
  openIndex: number | null;
  onClose: (viewedId?: string) => void;
  onNavigate: (nextIndex: number, viewedId: string) => void;
};

export function StoryViewer({
  openIndex,
  onClose,
  onNavigate,
}: StoryViewerProps) {
  const [slide, setSlide] = useState(0);
  const [prevIndex, setPrevIndex] = useState(openIndex);
  const story = openIndex !== null ? serviceStories[openIndex] : null;

  if (openIndex !== prevIndex) {
    setPrevIndex(openIndex);
    setSlide(0);
  }

  const goNext = useCallback(() => {
    if (!story || openIndex === null) return;
    if (slide < story.slides.length - 1) {
      setSlide((s) => s + 1);
    } else if (openIndex < serviceStories.length - 1) {
      onNavigate(openIndex + 1, story.id);
    } else {
      onClose(story.id);
    }
  }, [story, openIndex, slide, onNavigate, onClose]);

  const goPrev = useCallback(() => {
    if (openIndex === null) return;
    if (slide > 0) {
      setSlide((s) => s - 1);
    } else if (openIndex > 0) {
      onNavigate(openIndex - 1, serviceStories[openIndex].id);
    }
  }, [openIndex, slide, onNavigate]);

  useEffect(() => {
    if (!story) return;
    const timer = setTimeout(goNext, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [story, slide, goNext]);

  useEffect(() => {
    if (!story) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(story.id);
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [story, goNext, goPrev, onClose]);

  return (
    <AnimatePresence>
      {story && (
        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-50 mx-auto flex max-w-[560px] flex-col bg-sky"
          role="dialog"
          aria-label={`Story: ${story.label}`}
        >
          <div className="grid-pattern-bg pointer-events-none absolute inset-0 opacity-20" />

          <div className="relative z-10 flex gap-1 px-3 pt-3">
            {story.slides.map((_, i) => (
              <div
                key={i}
                className="h-0.5 flex-1 overflow-hidden rounded-full bg-snow/25"
              >
                {i === slide && (
                  <motion.div
                    key={`${openIndex}-${slide}`}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: SLIDE_MS / 1000, ease: "linear" }}
                    className="h-full bg-snow"
                  />
                )}
                {i < slide && <div className="h-full w-full bg-snow" />}
              </div>
            ))}
          </div>

          <div className="relative z-10 flex items-center justify-between px-4 pt-3">
            <div className="flex items-center gap-2.5">
              <span className="story-ring flex h-8 w-8 items-center justify-center rounded-full p-[2px]">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-sky">
                  <Image
                    src="/brand/grid_monogram_snow.png"
                    alt=""
                    width={18}
                    height={10}
                  />
                </span>
              </span>
              <span className="text-sm font-medium text-snow">
                grid.berlin
              </span>
              <span className="text-xs font-light text-snow/50">
                {story.label}
              </span>
            </div>
            <button
              onClick={() => onClose(story.id)}
              aria-label="Story schließen"
              className="text-snow transition-transform active:scale-90"
            >
              <X className="h-6 w-6" strokeWidth={2} />
            </button>
          </div>

          <div className="relative z-10 flex flex-1 items-center px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${story.id}-${slide}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className="text-4xl font-medium leading-tight tracking-tight text-snow">
                  {story.slides[slide].title}
                </h2>
                <p className="mt-4 text-base font-light leading-relaxed text-snow/70">
                  {story.slides[slide].text}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute inset-0 z-20 flex">
            <button
              className="w-1/3"
              onClick={goPrev}
              aria-label="Vorheriger Slide"
            />
            <button
              className="w-2/3"
              onClick={goNext}
              aria-label="Nächster Slide"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
