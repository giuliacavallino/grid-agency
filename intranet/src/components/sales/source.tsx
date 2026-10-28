import { Globe, HeartHandshake, Mail, PenLine } from "lucide-react";
import { SOURCES, type Source } from "@/lib/sales/types";
import { accentFill, accentText } from "@/lib/theme";

// Markenlogos sind in lucide nicht enthalten, daher als schlichte Glyphen.
function InstagramGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function LinkedInGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.8v1.6h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1v5.35h-4v-4.75c0-1.13-.02-2.6-1.58-2.6-1.59 0-1.83 1.24-1.83 2.52v4.83h-4v-11Z" />
    </svg>
  );
}

function MetaGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" {...props}>
      <path d="M3 15.5c0-4.5 2-8 4.3-8 3.2 0 6.2 9 9.4 9 2 0 4.3-2 4.3-5 0-2.6-1.3-4-2.9-4-3 0-5.8 8.5-9.6 8.5C5.1 16 3 16.2 3 15.5Z" />
    </svg>
  );
}

export const SOURCE_STYLE: Record<Source, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  // Gleiche Farbtöne wie in den Analytics-Diagrammen (charts/theme.ts)
  linkedin: { color: "#3987e5", icon: LinkedInGlyph },
  website: { color: "#d95926", icon: Globe },
  empfehlung: { color: "#199e70", icon: HeartHandshake },
  email: { color: "#c98500", icon: Mail },
  instagram: { color: "#d55181", icon: InstagramGlyph },
  manuell: { color: "#008300", icon: PenLine },
  meta: { color: "#9085e9", icon: MetaGlyph },
};

export const sourceLabel = (source: Source) => SOURCES.find((s) => s.id === source)?.label ?? source;

export function SourceBadge({ source, compact }: { source: Source; compact?: boolean }) {
  const { color, icon: Icon } = SOURCE_STYLE[source] ?? SOURCE_STYLE.manuell;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-4"
      style={{ background: accentFill(color), color: accentText(color) }}
      title={sourceLabel(source)}
    >
      <Icon className="h-3 w-3" />
      {!compact && sourceLabel(source)}
    </span>
  );
}
