import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[560px]">
      <header className="pointer-events-none fixed top-0 z-40 w-full max-w-[560px] px-5 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="glass pointer-events-auto relative mx-auto flex h-12 items-center gap-4 rounded-full px-5">
          <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-snow/40 to-transparent" />
          <Link href="/" aria-label="Zurück" className="relative text-snow">
            <ArrowLeft className="h-5 w-5" strokeWidth={1.8} />
          </Link>
          <span className="relative text-sm font-medium text-snow">
            {title}
          </span>
          <Image
            src="/brand/grid_logo_snow.png"
            alt="GRID"
            width={64}
            height={17}
            className="relative ml-auto"
          />
        </div>
      </header>
      <main className="px-4 pb-16 pt-28">{children}</main>
    </div>
  );
}
