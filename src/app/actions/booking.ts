"use server";

import { intranet } from "@/lib/intranet";

export type MeetingKind = "erstgespraech" | "kickoff";

export type BookingView = {
  kind: MeetingKind;
  minutes: number;
  host: string;
  prefill: { name: string; email: string; company: string } | null;
  booked: { start: string; url: string | null } | null;
  slots: string[];
  calendar_error: boolean;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const message = (error: unknown) => (error instanceof Error ? error.message : "Da ist etwas schiefgelaufen.");

/** Freie Termine (und Vorbelegung, wenn ein Einladungslink da ist) */
export async function loadBooking(kind: MeetingKind, token: string | null): Promise<Result<BookingView>> {
  const params = new URLSearchParams({ art: kind, ...(token ? { l: token } : {}) });
  try {
    return { ok: true, data: await intranet<BookingView>(`/api/public/termin?${params}`) };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export type BookingInput = {
  kind: MeetingKind;
  token: string | null;
  start: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
  altcha: string;
};

/** Termin buchen; das Intranet legt ihn im Kalender an und lädt per Outlook ein */
export async function bookSlot(input: BookingInput): Promise<Result<{ start: string; url: string | null }>> {
  try {
    return { ok: true, data: await intranet(`/api/public/termin`, { method: "POST", body: JSON.stringify(input) }) };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}
