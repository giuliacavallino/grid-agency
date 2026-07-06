import Image from "next/image";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-snow/10">
      <div className="grid-pattern-bg pointer-events-none absolute inset-0 opacity-10" />

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <Image
            src="/brand/grid_logo_snow.png"
            alt="GRID Agency"
            width={90}
            height={24}
          />

          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm font-light text-snow/60">
            <a
              href="https://instagram.com/grid.berlin"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-snow"
            >
              Instagram
            </a>
            <a href="/impressum" className="transition-colors hover:text-snow">
              Impressum
            </a>
            <a href="/datenschutz" className="transition-colors hover:text-snow">
              Datenschutz
            </a>
          </div>
        </div>

        <p className="mt-8 text-xs font-light text-snow/30">
          © {new Date().getFullYear()} GRID Agency UG. Serving the coolest
          brands.
        </p>
      </div>
    </footer>
  );
}
