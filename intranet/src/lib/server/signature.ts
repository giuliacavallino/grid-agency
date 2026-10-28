import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const hmacHex = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("hex");

/** Vergleich in konstanter Zeit, damit Signaturen nicht erraten werden können. */
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
