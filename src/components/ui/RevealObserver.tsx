"use client";

import { useEffect } from "react";

/** Blendet alle `.reveal`-Elemente ein, sobald sie ins Bild scrollen
 * (setzt `data-shown`, die Animation steht in globals.css). Ein einziger
 * Observer für die ganze Seite statt einer Animations-Bibliothek; neue
 * Elemente (Seitenwechsel, nachgeladene Inhalte) findet der
 * MutationObserver. */
export function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-shown", "");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const scan = () =>
      document.querySelectorAll(".reveal:not([data-shown])").forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
