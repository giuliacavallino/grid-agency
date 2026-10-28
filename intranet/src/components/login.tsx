"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { LoaderCircle } from "lucide-react";
import { authErrorMessage, signIn, useAuth } from "@/lib/auth";
import { DOMAIN } from "@/lib/config";
import { Logo } from "./logo";

function MicrosoftLogo() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 21 21" aria-hidden>
      <path fill="#f25022" d="M0 0h10v10H0z" />
      <path fill="#7fba00" d="M11 0h10v10H11z" />
      <path fill="#00a4ef" d="M0 11h10v10H0z" />
      <path fill="#ffb900" d="M11 11h10v10H11z" />
    </svg>
  );
}

const pill =
  "flex h-12 w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-medium transition-[transform,box-shadow,background-color,opacity] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress aria-busy:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-snow";

export function Login() {
  const auth = useAuth();
  const [busy, setBusy] = useState<"microsoft" | "email" | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<{ text: string; field?: boolean } | null>(null);
  const checking = auth.status === "loading";
  const shownError = error ?? (auth.error ? { text: auth.error } : null);

  async function start(kind: "microsoft" | "email", request: Parameters<typeof signIn>[0]) {
    setError(null);
    setBusy(kind);
    try {
      // Leitet die Seite zu Microsoft weiter; der Spinner bleibt bis dahin.
      await signIn(request);
    } catch (err) {
      setError({ text: authErrorMessage(err) });
      setBusy(null);
    }
  }

  // E-Mail vorab: Microsoft springt mit dem Hinweis direkt zur
  // Passworteingabe für genau dieses Konto.
  function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return setError({ text: "Bitte gib eine gültige E-Mail-Adresse ein.", field: true });
    }
    if (!value.endsWith(`@${DOMAIN}`)) {
      return setError({ text: `Bitte nutze deine @${DOMAIN}-Adresse.`, field: true });
    }
    start("email", { loginHint: value, prompt: "login" });
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden px-4 pt-6 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="pattern-bg login-pattern pointer-events-none fixed inset-0" aria-hidden />
      <div className="aurora login-aurora pointer-events-none fixed -inset-[10%]" aria-hidden />

      <main className="relative grid flex-1 place-items-center">
        <section className="w-full max-w-80 text-center">
          <a href="https://grid-agency.de" aria-label="Zur GRID Website" className="mb-9 flex flex-col items-center">
            <span className="login-logo relative w-32">
              <Logo priority className="h-auto w-full" />
            </span>
            <h1 className="login-kicker mt-2.5 text-xs font-normal uppercase tracking-[0.35em] text-snow/55">
              Intranet
            </h1>
          </a>

          <div className="login-content">
            <p className="mb-6 text-sm leading-relaxed text-snow/55 text-balance">
              Melde dich mit deinem GRID-Microsoft-Konto an.
            </p>

            <button
              type="button"
              className={clsx(pill, "btn-rainbow bg-snow text-sky")}
              disabled={checking || busy !== null}
              aria-busy={checking || busy === "microsoft" || undefined}
              onClick={() => start("microsoft", { prompt: "select_account" })}
            >
              {checking || busy === "microsoft" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <MicrosoftLogo />
              )}
              {checking
                ? "Anmeldung wird geprüft …"
                : busy === "microsoft"
                  ? "Weiterleitung zu Microsoft …"
                  : "Mit Microsoft anmelden"}
            </button>

            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.25em] text-snow/35 before:h-px before:flex-1 before:bg-snow/12 after:h-px after:flex-1 after:bg-snow/12">
              oder mit E-Mail
            </div>

            <form onSubmit={submitEmail} noValidate>
              <label className="sr-only" htmlFor="login-email">
                E-Mail
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder={`vorname@${DOMAIN}`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error?.field) setError(null);
                }}
                aria-invalid={error?.field || undefined}
                className="mb-2.5 h-12 w-full rounded-full border border-snow/15 bg-sky/60 px-4.5 text-center text-base text-snow outline-none transition-[border-color,box-shadow] placeholder:text-snow/35 focus:border-snow/45 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-snow)_10%,transparent)] aria-invalid:border-error"
              />
              <button
                type="submit"
                className={clsx(pill, "border border-snow/20 bg-sky/40 text-snow hover:bg-snow/[0.08]")}
                disabled={checking || busy !== null}
                aria-busy={busy === "email" || undefined}
              >
                {busy === "email" && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
                {busy === "email" ? "Weiter zu Microsoft …" : "Weiter zum Passwort"}
              </button>
            </form>
            <p className="mt-2.5 text-xs text-snow/35 text-balance">Dein Passwort gibst du danach bei Microsoft ein.</p>
            <p role="status" aria-live="polite" className="mt-3 min-h-5 text-[13px] text-error">
              {shownError?.text}
            </p>
          </div>
        </section>
      </main>

      <footer className="login-footer relative flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px]">
        {[
          ["mailto:hello@grid-agency.de?subject=Intranet-Login", "Hilfe beim Login"],
          ["https://grid-agency.de/impressum", "Impressum"],
          ["https://grid-agency.de/datenschutz", "Datenschutz"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="text-snow/35 hover:text-snow/55">
            {label}
          </a>
        ))}
      </footer>
    </div>
  );
}

/** Zeigt den Inhalt nur angemeldet, sonst die Loginseite (URL bleibt). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.status === "signed-in") return <>{children}</>;
  return <Login />;
}
