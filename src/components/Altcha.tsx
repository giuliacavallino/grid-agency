"use client";

import { useEffect, useRef } from "react";
// Typen für <altcha-widget> im JSX bringt das Paket mit
import type {} from "altcha";

// Captcha (ALTCHA): löst im Hintergrund eine kleine Rechenaufgabe, sobald
// das Formular sichtbar ist. Keine Cookies, kein Drittanbieter – die Aufgabe
// kommt über /api/altcha vom Intranet. Das Ergebnis steht im Formularfeld
// „altcha“ bzw. kommt über onChange. Unsichtbar: Nutzer müssen nichts tun.

const STRINGS = {
  label: "Ich bin kein Roboter",
  verified: "Bestätigt",
  verifying: "Wird geprüft …",
  waitAlert: "Wird geprüft … bitte einen Moment.",
  error: "Prüfung fehlgeschlagen. Bitte lade die Seite neu.",
  expired: "Abgelaufen – bitte erneut bestätigen.",
  ariaLinkLabel: "ALTCHA",
  footer: "",
};

export function Altcha({ onChange }: { onChange?: (payload: string | null) => void }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    import("altcha");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onChange) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ state: string; payload?: string }>).detail;
      onChange(detail.state === "verified" ? (detail.payload ?? null) : null);
    };
    el.addEventListener("statechange", handler);
    return () => el.removeEventListener("statechange", handler);
  }, [onChange]);

  return (
    <div aria-hidden className="sr-only">
      <altcha-widget
        ref={ref}
        challengeurl="/api/altcha"
        name="altcha"
        auto="onload"
        hidelogo
        hidefooter
        strings={JSON.stringify(STRINGS)}
      />
    </div>
  );
}
