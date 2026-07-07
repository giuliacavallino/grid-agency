"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { MainMenu } from "./MainMenu";

/** Standalone burger for pages outside the app shell (LegalShell). */
export function MenuButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        aria-label="Menü öffnen"
        onClick={() => setOpen(true)}
        className="relative text-snow transition-transform active:scale-90"
      >
        <Menu className="h-[22px] w-[22px]" strokeWidth={1.8} />
      </button>
      <MainMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
