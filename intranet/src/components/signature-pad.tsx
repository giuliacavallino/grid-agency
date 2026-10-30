"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Type } from "lucide-react";
import { cn } from "@/lib/cn";

/** Unterschrift zeichnen (Maus, Finger, Stift) oder Namen tippen. Liefert ein
 * transparentes PNG (data-URL) in dunkler Tinte, oder null, solange leer. */
export function SignaturePad({ onChange, name, className }: { onChange: (png: string | null) => void; name?: string; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const ink = useRef(false);
  const [mode, setMode] = useState<"zeichnen" | "tippen">("zeichnen");
  const [typed, setTyped] = useState(name ?? "");
  const [empty, setEmpty] = useState(true);

  // Zeichenfläche in Gerätepixeln, damit die Linie scharf bleibt
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.max(2, window.devicePixelRatio || 1);
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1f1d33";
    ctx.lineWidth = 2.4;
  }, [mode]);

  function clear() {
    const c = canvas.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    ink.current = false;
    setEmpty(true);
    onChange(null);
  }

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = point(event);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = event.currentTarget.getContext("2d")!;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!ink.current) {
      ink.current = true;
      setEmpty(false);
    }
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (ink.current && canvas.current) onChange(canvas.current.toDataURL("image/png"));
  }

  // Getippter Name als Schriftzug
  function renderTyped(text: string) {
    setTyped(text);
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 300;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#1f1d33";
    ctx.textBaseline = "middle";
    let size = 130;
    do {
      ctx.font = `italic 400 ${size}px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive`;
      size -= 6;
    } while (ctx.measureText(text).width > 1120 && size > 40);
    ctx.fillText(text, 40, 160);
    onChange(text.trim() ? c.toDataURL("image/png") : null);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex gap-1">
        {(
          [
            ["zeichnen", "Zeichnen", PenLine],
            ["tippen", "Tippen", Type],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              ink.current = false;
              setEmpty(true);
              onChange(null);
              if (id === "tippen" && typed) renderTyped(typed);
            }}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px]",
              mode === id ? "bg-snow/[0.12] font-medium text-snow" : "text-snow/60 hover:bg-snow/[0.06]"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
        {mode === "zeichnen" && (
          <button type="button" onClick={clear} className="ml-auto flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-snow/60 hover:bg-snow/[0.06]">
            <Eraser className="h-3.5 w-3.5" />
            Neu
          </button>
        )}
      </div>
      {mode === "zeichnen" ? (
        <div className="relative">
          <canvas
            ref={canvas}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            aria-label="Unterschriftsfeld"
            className="h-40 w-full touch-none rounded-2xl border border-dashed border-snow/25 bg-white"
          />
          {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[#8c867c]">Hier unterschreiben</span>}
          <span className="pointer-events-none absolute right-6 bottom-8 left-6 border-b border-[#d8d5cf]" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            value={typed}
            onChange={(e) => renderTyped(e.target.value)}
            placeholder="Vor- und Nachname"
            aria-label="Name für die Unterschrift"
            className="h-10 w-full rounded-xl border border-snow/12 bg-ink/60 px-3 text-sm text-snow outline-none focus:border-snow/40"
          />
          <div className="flex h-40 items-center overflow-hidden rounded-2xl border border-dashed border-snow/25 bg-white px-6">
            <span className="truncate text-5xl text-[#1f1d33] italic" style={{ fontFamily: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive' }}>
              {typed || <span className="text-base text-[#8c867c] not-italic">Ihr Name erscheint hier</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
