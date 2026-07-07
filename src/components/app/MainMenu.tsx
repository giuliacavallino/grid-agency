"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { scrollToId, stashScrollTarget } from "@/lib/scroll";

type SectionItem = { kind: "section"; id: string; label: string };
type PageItem = { kind: "page"; href: string; label: string };
type Item = SectionItem | PageItem;

const items: Item[] = [
  { kind: "section", id: "home", label: "Start" },
  { kind: "section", id: "team", label: "Über uns & Team" },
  { kind: "section", id: "prozess", label: "Arbeitsprozess" },
  { kind: "section", id: "feed", label: "Live-Feed" },
  { kind: "page", href: "/referenzen", label: "Referenzen" },
  { kind: "page", href: "/events", label: "Events" },
  { kind: "section", id: "dm", label: "Kontakt" },
];

export function MainMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Portal to <body>: ancestors with backdrop-filter (the glass bars)
  // would otherwise become the containing block for this fixed overlay.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const goToSection = (id: string) => {
    onClose();
    if (pathname === "/") {
      scrollToId(id);
    } else {
      stashScrollTarget(id);
      router.push("/");
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] flex flex-col bg-sky/85 backdrop-blur-2xl"
        >
          <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+12px)]">
            <div className="flex h-12 items-center justify-between">
              <Image
                src="/brand/grid_logo_snow.png"
                alt="GRID"
                width={72}
                height={19}
              />
              <button
                aria-label="Menü schließen"
                onClick={onClose}
                className="glass flex h-10 w-10 items-center justify-center rounded-full text-snow transition-transform active:scale-90"
              >
                <X className="h-5 w-5" strokeWidth={1.8} />
              </button>
            </div>

            <nav className="mt-10 flex flex-1 flex-col gap-1">
              {items.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 + i * 0.05 }}
                >
                  {item.kind === "section" ? (
                    <button
                      onClick={() => goToSection(item.id)}
                      className="py-2.5 text-left text-3xl font-medium tracking-tight text-snow transition-colors hover:text-dune"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className="block py-2.5 text-3xl font-medium tracking-tight text-snow transition-colors hover:text-dune"
                    >
                      {item.label}
                    </Link>
                  )}
                </motion.div>
              ))}
            </nav>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.45 }}
              className="flex items-center gap-5 text-sm font-light text-snow/50"
            >
              <Link
                href="/impressum"
                onClick={onClose}
                className="underline-offset-4 hover:underline"
              >
                Impressum
              </Link>
              <Link
                href="/datenschutz"
                onClick={onClose}
                className="underline-offset-4 hover:underline"
              >
                Datenschutz
              </Link>
              <span className="ml-auto text-xs uppercase tracking-[0.2em] text-snow/30">
                Berlin · Frankfurt
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
