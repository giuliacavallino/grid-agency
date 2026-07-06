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
      <header className="fixed top-0 z-40 flex h-14 w-full max-w-[560px] items-center gap-4 border-b border-snow/10 bg-sky/85 px-4 backdrop-blur-lg">
        <Link href="/" aria-label="Zurück" className="text-snow">
          <ArrowLeft className="h-6 w-6" strokeWidth={1.8} />
        </Link>
        <span className="text-sm font-medium text-snow">{title}</span>
        <Image
          src="/brand/grid_logo_snow.png"
          alt="GRID"
          width={64}
          height={17}
          className="ml-auto"
        />
      </header>
      <main className="px-4 pb-16 pt-24">{children}</main>
    </div>
  );
}
