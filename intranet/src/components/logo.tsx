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
