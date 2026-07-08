import Image from "next/image";
import Link from "next/link";
import { MenuButton } from "./MenuButton";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-frame lg:max-w-frame-lg">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="mx-auto w-full max-w-frame px-5 lg:max-w-frame-lg">
        <div className="glass-dark pointer-events-auto relative flex h-12 w-full items-center gap-4 rounded-full px-5">
          <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-snow/40 to-transparent" />
          {/* The GRID mark leads back home; hover runs the aurora
              gradient through the letters and zooms slightly. */}
          <Link href="/" aria-label="Zur Startseite" className="logo-rainbow relative">
            <Image
              src="/brand/grid_logo_snow.png"
              alt="GRID"
              width={64}
              height={17}
            />
          </Link>
          <span className="relative text-sm font-medium text-snow">
            {title}
          </span>
          <span className="relative ml-auto flex items-center">
            <MenuButton />
          </span>
        </div>
        </div>
      </header>
      <main className="px-5 pb-16 pt-28">{children}</main>
    </div>
  );
}
