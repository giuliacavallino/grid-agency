"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { openBooking, scrollToId, stashScrollTarget } from "@/lib/scroll";

/** Kontakt-Link: „termin“ öffnet das Erstgespräch-Popup (auf jeder Seite),
 * „nachricht“ führt zum Kontaktformular auf der Startseite. Ersetzt
 * Calendly- und Mail-Links; jede Anfrage landet so in der Sales-Pipeline. */
export function ContactLink({
  tab = "termin",
  className,
  children,
  onNavigate,
}: {
  tab?: "termin" | "nachricht";
  className?: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <Link
      href="/#dm"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onNavigate?.();
        if (tab === "termin") {
          openBooking();
        } else if (pathname === "/") {
          scrollToId("dm");
        } else {
          stashScrollTarget("dm");
          router.push("/");
        }
      }}
    >
      {children}
    </Link>
  );
}

/** Link auf eine Sektion der Startseite, auch von Unterseiten aus. */
export function SectionLink({
  id,
  className,
  children,
  onNavigate,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <Link
      href={`/#${id}`}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onNavigate?.();
        if (pathname === "/") {
          scrollToId(id);
        } else {
          stashScrollTarget(id);
          router.push("/");
        }
      }}
    >
      {children}
    </Link>
  );
}
