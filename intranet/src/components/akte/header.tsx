"use client";

/** Kopf einer Akte-Seite: Titel, Untertitel, Aktionen rechts */
export function AkteHeader({ title, meta, children }: { title: string; meta?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-snow/[0.08] px-4 py-3 md:px-7">
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold tracking-tight">{title}</h1>
        {meta && <p className="text-[12.5px] text-snow/55">{meta}</p>}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">{children}</div>
    </header>
  );
}
