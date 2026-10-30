import { openSync, readSync, closeSync } from "node:fs";
import path from "node:path";

const cache = new Map<string, { width: number; height: number }>();

/** Pixelmaße eines PNG unter /public, direkt aus dem Dateikopf gelesen.
 * Damit können Logos über next/image (WebP/AVIF, passende Größe) laufen
 * und haben vor dem Laden schon ihre Breite, also springt kein Laufband. */
export function pngSize(publicPath: string) {
  const known = cache.get(publicPath);
  if (known) return known;
  const fd = openSync(path.join(process.cwd(), "public", publicPath), "r");
  const head = Buffer.alloc(24);
  readSync(fd, head, 0, 24, 0);
  closeSync(fd);
  const size = { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  cache.set(publicPath, size);
  return size;
}

/** Breite eines Logos bei gegebener Anzeigehöhe (px). */
export function logoWidth(publicPath: string, height: number) {
  const { width, height: h } = pngSize(publicPath);
  return Math.round((width / h) * height);
}

/** Pixelmaße eines WebP unter /public (VP8, VP8L und VP8X). */
function webpSize(publicPath: string) {
  const fd = openSync(path.join(process.cwd(), "public", publicPath), "r");
  const b = Buffer.alloc(30);
  readSync(fd, b, 0, 30, 0);
  closeSync(fd);
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
}

/** Maße für Galeriebilder (PNG/WebP); andere Formate bekommen 3:4. */
export function imageSize(publicPath: string): [number, number] {
  try {
    const size = publicPath.endsWith(".webp")
      ? webpSize(publicPath)
      : publicPath.endsWith(".png")
        ? pngSize(publicPath)
        : null;
    return size ? [size.width, size.height] : [900, 1200];
  } catch {
    return [900, 1200];
  }
}
