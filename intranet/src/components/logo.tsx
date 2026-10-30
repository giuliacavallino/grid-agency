import Image from "next/image";
import { cn } from "@/lib/cn";

/** GRID-Wortmarke: hell auf dunklem, dunkel auf hellem Hintergrund. */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <>
      <Image src="/assets/logo.png" alt="GRID" width={626} height={226} priority={priority} className={cn("hidden w-auto dark:block", className)} />
      <Image src="/assets/logo-dark.png" alt="GRID" width={626} height={226} priority={priority} className={cn("block w-auto dark:hidden", className)} />
    </>
  );
}

/** Produktmarke im GRID-Stil: Wortmarke, Aurora-Strich, Produktname dünn und
 * gesperrt im selben Ton wie die Wortmarke (z. B. GRID | MEET, GRID | SIGN). */
export function ProductMark({
  product,
  size = "md",
  rainbow,
  priority,
  className,
}: {
  product: string;
  size?: "sm" | "md";
  /** Regenbogen beim Hover über die Wortmarke (wie auf der Website) */
  rainbow?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const sm = size === "sm";
  const logo = <Logo className={sm ? "h-5" : "h-6"} priority={priority} />;
  return (
    <span className={cn("inline-flex shrink-0 items-center", sm ? "gap-2.5" : "gap-3", className)} aria-label={`GRID ${product}`}>
      {rainbow ? <span className="logo-rainbow">{logo}</span> : logo}
      <span aria-hidden className={cn("w-[2px] rounded-full bg-[linear-gradient(180deg,#feda75,#fa7e1e,#d62976,#962fbf)]", sm ? "h-4" : "h-5")} />
      <span aria-hidden className={cn("leading-none font-light tracking-[0.22em] text-snow/45 uppercase", sm ? "text-[1.2rem]" : "text-[1.45rem]")}>
        {product}
      </span>
    </span>
  );
}
