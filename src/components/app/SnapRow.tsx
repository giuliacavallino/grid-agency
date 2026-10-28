"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Horizontale Wisch-Reihe für Karten, die untereinander mehrere
 * Bildschirme hoch wären: per Finger oder Trackpad wischen, Karten
 * rasten ein. Mit `arrows` gibt es ab Desktop Pfeile für Mausnutzer
 * ohne horizontales Scrollrad, `footer` steht links daneben (mobil
 * mittig unter der Reihe). `controlsAbove` setzt beides ab Desktop
 * rechts über die Reihe, auf Höhe der Überschrift. Die Reihe läuft bis an den Bildschirm-
 * rand, die umgebende Sektion braucht dafür `px-5 lg:px-gutter`. */
export function SnapRow({
  children,
  className = "",
  arrows = false,
  footer,
  controlsAbove = false,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  arrows?: boolean;
  footer?: React.ReactNode;
  controlsAbove?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div ref={ref} className={`snap-row ${className}`} aria-label={label}>
        {children}
      </div>
      {(arrows || footer) && (
        <div
          className={`mt-[clamp(1rem,2.5svh,1.5rem)] flex items-center justify-center gap-4 lg:justify-between ${
            controlsAbove ? "lg:absolute lg:bottom-full lg:right-0 lg:mt-0" : ""
          }`}
        >
          {footer}
          {arrows && (
            <div className="ml-auto hidden gap-2 lg:flex">
              {([-1, 1] as const).map((dir) => {
                const Icon = dir === -1 ? ChevronLeft : ChevronRight;
                return (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => page(dir)}
                    aria-label={dir === -1 ? "Zurück" : "Weiter"}
                    className="glass flex h-11 w-11 items-center justify-center rounded-full text-snow transition-transform hover:scale-105 active:scale-95"
                  >
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
