import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { LegalShell } from "@/components/app/LegalShell";
import { clients, clientSlug } from "@/lib/content";

export function generateStaticParams() {
  return clients.map((c) => ({ slug: clientSlug(c.name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = clients.find((c) => clientSlug(c.name) === slug);
  return {
    title: client
      ? `${client.name} — Referenz | GRID Agency`
      : "Referenz — GRID Agency",
    description: client?.intro,
  };
}

function Gallery({ images, alt }: { images: string[]; alt: string }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {images.map((src) => (
        <div
          key={src}
          className="relative aspect-square overflow-hidden rounded-xl"
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 560px) 50vw, 180px"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}

export default async function ClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = clients.find((c) => clientSlug(c.name) === slug);
  if (!client) notFound();

  return (
    <LegalShell title={client.name}>
      <div className="px-4">
        <div className="flex min-h-24 items-center justify-center py-4">
          {client.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo}
              alt={client.name}
              style={{ height: Math.min((client.height ?? 32) * 1.8, 80) }}
              className="w-auto"
            />
          ) : (
            <span className="text-2xl font-light uppercase tracking-[0.2em] text-snow/70">
              {client.name}
            </span>
          )}
        </div>

        {client.intro && (
          <p className="mx-auto max-w-[30rem] text-center text-sm font-light leading-relaxed text-snow/70">
            {client.intro}
          </p>
        )}

        {client.instagram && (
          <p className="mt-4 text-center">
            <a
              href={`https://www.instagram.com/${client.instagram}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-dune underline-offset-4 hover:underline"
            >
              @{client.instagram} auf Instagram →
            </a>
          </p>
        )}

        {client.caseStudy && (
          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
              Der Case
            </h2>
            <p className="mt-3 rounded-2xl bg-black p-5 text-sm font-light leading-relaxed text-snow/85">
              {client.caseStudy}
            </p>
          </section>
        )}

        {client.sections?.map((section) => (
          <section key={section.title} className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
              {section.title}
            </h2>
            {section.text && (
              <p className="mt-3 text-sm font-light leading-relaxed text-snow/70">
                {section.text}
              </p>
            )}
            {section.images && section.images.length > 0 ? (
              <Gallery images={section.images} alt={client.name} />
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-snow/15 px-4 py-6 text-center text-xs font-light text-snow/40">
                Material folgt in Kürze.
              </p>
            )}
          </section>
        ))}

        <section className="mt-10">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
            Galerie
          </h2>
          {client.gallery && client.gallery.length > 0 ? (
            <Gallery images={client.gallery} alt={client.name} />
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-snow/15 px-4 py-6 text-center text-xs font-light text-snow/40">
              Einblicke folgen in Kürze.
            </p>
          )}
        </section>
      </div>
    </LegalShell>
  );
}
