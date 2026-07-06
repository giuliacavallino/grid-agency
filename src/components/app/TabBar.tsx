"use client";

import { useEffect, useRef, useState } from "react";
import { Home, LayoutGrid, Clapperboard, MessageCircle } from "lucide-react";
import { animate, motion, useMotionValue } from "framer-motion";
import type { ViewId } from "./AppShell";

const tabs: { id: ViewId; label: string; icon: typeof Home }[] = [
  { id: "profil", label: "Profil", icon: Home },
  { id: "feed", label: "Feed", icon: LayoutGrid },
  { id: "reels", label: "Reels", icon: Clapperboard },
  { id: "dm", label: "DM", icon: MessageCircle },
];

const LENS_SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };
const LENS_INSET = 6;
/** Ignore scroll-spy updates for this long after a drag release, so the
 * lens stays pinned to its drop target while the page scrolls there. */
const PIN_MS = 1000;

function haptic(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
}

function clampIndex(i: number) {
  return Math.min(Math.max(i, 0), tabs.length - 1);
}

export function TabBar({ active }: { active: ViewId }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [slotW, setSlotW] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const pinnedUntil = useRef(0);
  const measured = useRef(false);
  const x = useMotionValue(0);

  const activeIdx = tabs.findIndex((t) => t.id === active);
  const lensW = Math.max(slotW - LENS_INSET * 2, 0);
  const slotX = (i: number) => i * slotW + LENS_INSET;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setSlotW(el.clientWidth / tabs.length);
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!slotW || dragging) return;
    if (!measured.current) {
      // First measurement: place the lens without animating in from 0.
      measured.current = true;
      x.set(slotX(activeIdx));
      return;
    }
    if (Date.now() < pinnedUntil.current) return;
    const controls = animate(x, slotX(activeIdx), LENS_SPRING);
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, slotW, dragging]);

  function indexUnderLens() {
    return clampIndex(Math.round((x.get() - LENS_INSET) / slotW));
  }

  function onDrag() {
    const i = indexUnderLens();
    if (i !== hovered) {
      setHovered(i);
      haptic(5);
    }
  }

  function onDragEnd() {
    const i = indexUnderLens();
    setDragging(false);
    setHovered(null);
    pinnedUntil.current = Date.now() + PIN_MS;
    animate(x, slotX(i), LENS_SPRING);
    haptic(12);
    document
      .getElementById(tabs[i].id)
      ?.scrollIntoView({ behavior: "smooth" });
  }

  const displayIdx = dragging && hovered !== null ? hovered : activeIdx;

  return (
    <motion.nav
      initial={{ y: 96, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-none fixed bottom-0 z-40 w-full max-w-[560px] px-5 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      aria-label="Hauptnavigation"
    >
      <div className="glass pointer-events-auto relative mx-auto h-[68px] max-w-[400px] overflow-hidden rounded-full">
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-snow/40 to-transparent" />

        <div className="absolute inset-0 flex items-stretch justify-around px-2">
          {tabs.map((tab, i) => {
            const isLit = displayIdx === i;
            const Icon = tab.icon;
            return (
              <a
                key={tab.id}
                href={`#${tab.id}`}
                onClick={() => haptic(8)}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5"
                aria-current={active === tab.id ? "page" : undefined}
              >
                <motion.span
                  animate={{ scale: isLit ? 1.18 : 1, y: isLit ? -1 : 0 }}
                  transition={LENS_SPRING}
                >
                  <Icon
                    className={`h-6 w-6 transition-colors duration-300 ${
                      isLit ? "text-snow" : "text-snow/45"
                    }`}
                    strokeWidth={isLit ? 2.2 : 1.8}
                  />
                </motion.span>
                <motion.span
                  animate={{ opacity: isLit ? 1 : 0.45 }}
                  transition={{ duration: 0.3 }}
                  className="text-[10px] font-light text-snow"
                >
                  {tab.label}
                </motion.span>
              </a>
            );
          })}
        </div>

        {/* Draggable lens track */}
        <div ref={trackRef} className="absolute inset-x-2 inset-y-2">
          {slotW > 0 && (
            <motion.div
              drag="x"
              dragConstraints={{
                left: LENS_INSET,
                right: slotX(tabs.length - 1),
              }}
              dragElastic={0.06}
              dragMomentum={false}
              onDragStart={() => setDragging(true)}
              onDrag={onDrag}
              onDragEnd={onDragEnd}
              whileDrag={{ scale: 1.08 }}
              style={{ x, width: lensW }}
              className="glass-lens absolute inset-y-0 z-10 cursor-grab touch-none rounded-full active:cursor-grabbing"
              aria-hidden
            />
          )}
        </div>
      </div>
    </motion.nav>
  );
}
