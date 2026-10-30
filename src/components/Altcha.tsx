"use client";

import { useEffect, useRef } from "react";
// Typen für <altcha-widget> im JSX bringt das Paket mit
import type {} from "altcha";

// Captcha (ALTCHA): löst im Hintergrund eine kleine Rechenaufgabe, sobald
// das Formular sichtbar ist. Keine Cookies, kein Drittanbieter – die Aufgabe
// kommt über /api/altcha vom Intranet. Das Ergebnis steht im Formularfeld
// „altcha“ bzw. kommt über onChange.

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

export function Altcha({ onChange, light }: { onChange?: (payload: string | null) => void; light?: boolean }) {
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

  const colors = light ? ["rgba(43,41,38,0.15)", "#2b2926"] : ["rgba(228,226,231,0.15)", "#e4e2e7"];
  return (
    <altcha-widget
      ref={ref}
      challengeurl="/api/altcha"
      name="altcha"
      auto="onload"
      hidelogo
      hidefooter
      strings={JSON.stringify(STRINGS)}
      style={
        {
          "--altcha-color-base": "transparent",
          "--altcha-color-border": colors[0],
          "--altcha-color-text": colors[1],
          "--altcha-border-radius": "0.5rem",
          "--altcha-max-width": "100%",
        } as AltchaWidgetCSSProperties
      }
    />
  );
}
