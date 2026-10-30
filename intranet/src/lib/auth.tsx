"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type RedirectRequest,
} from "@azure/msal-browser";
import { CLIENT_ID, DEMO, DOMAIN, TENANT_ID } from "./config";

export type Account = { name: string; email: string };

type AuthState =
  | { status: "loading"; account: null; error: null }
  | { status: "signed-out"; account: null; error: string | null }
  | { status: "signed-in"; account: Account; error: null };

const DEMO_ACCOUNT: Account = { name: "Vorschau Konto", email: `vorschau@${DOMAIN}` };

// Eine Instanz für die ganze App. Im Browser angelegt, damit der Server
// beim Rendern nichts von MSAL braucht.
let msal: PublicClientApplication | null = null;
let ready: Promise<AccountInfo | null> | null = null;

function client() {
  if (!msal) {
    msal = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: `${window.location.origin}/`,
        postLogoutRedirectUri: `${window.location.origin}/`,
      },
      cache: { cacheLocation: "localStorage" },
    });
  }
  return msal;
}

/** Läuft die Seite als Rückkehrziel einer stillen Anmeldung (verstecktes
 * iframe) oder eines Popups? Dann nur die Antwort an das Hauptfenster
 * weiterreichen (MSAL v5 „redirect bridge“), sonst wartet MSAL dort bis
 * zum Timeout. */
function isAuthCallbackFrame() {
  const inFrame = window.parent !== window || !!window.opener;
  return inFrame && /[#?&](state|code|error)=/.test(window.location.hash + window.location.search);
}

/** Initialisiert MSAL einmal und verarbeitet die Rückkehr vom Login. */
function init() {
  if (!ready) {
    ready = (async () => {
      if (isAuthCallbackFrame()) {
        const { broadcastResponseToMainFrame } = await import("@azure/msal-browser/redirect-bridge");
        await broadcastResponseToMainFrame().catch(() => {});
        // Dieses Fenster wird gleich geschlossen; die App hier nicht starten.
        return new Promise<AccountInfo | null>(() => {});
      }
      const app = client();
      await app.initialize();
      const result = await app.handleRedirectPromise();
      const account = result?.account ?? app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
      if (account) app.setActiveAccount(account);
      return account;
    })();
  }
  return ready;
}

function toAccount(info: AccountInfo): Account {
  return { name: info.name || info.username, email: info.username };
}

export function authErrorMessage(error: unknown) {
  const err = error as { errorCode?: string; message?: string } | null;
  const code = err?.errorCode;
  if (code === "user_cancelled") return "Anmeldung abgebrochen.";
  if (code === "interaction_in_progress") return "Eine Anmeldung läuft bereits. Bitte kurz warten.";
  if (code === "access_denied" || /AADSTS50020|AADSTS90072/.test(err?.message ?? ""))
    return `Bitte melde dich mit deinem @${DOMAIN}-Konto an.`;
  return "Anmeldung fehlgeschlagen. Bitte versuch es erneut.";
}

/** Profilbilder des Teams (wie in Teams); wird beim Login gleich mit
 * zugestimmt, damit später keine Rückfrage kommt. */
const PROFILE_SCOPES = ["User.ReadBasic.All"];

/** Leitet zum Microsoft-Login weiter; danach geht es zur aktuellen Seite zurück. */
export async function signIn(request: Partial<RedirectRequest> = {}) {
  await init();
  await client().loginRedirect({ scopes: ["User.Read"], extraScopesToConsent: PROFILE_SCOPES, ...request });
}

export async function signOut() {
  if (DEMO) {
    window.location.href = "/";
    return;
  }
  await init();
  const app = client();
  await app.logoutRedirect({ account: app.getActiveAccount() ?? undefined });
}

let pendingToken: Promise<string> | null = null;
let redirecting = false;

/** Fehler, bei denen nur eine neue Anmeldung hilft: Sitzung abgelaufen oder
 * die stille Erneuerung im Hintergrund kam nicht zurück (z. B. weil der
 * Browser Drittanbieter-Cookies blockiert). */
function needsInteraction(error: unknown) {
  const code = (error as { errorCode?: string } | null)?.errorCode;
  return error instanceof InteractionRequiredAuthError || code === "timed_out" || code === "monitor_window_timeout";
}

/** ID-Token für die eigenen API-Routen. Der Server prüft Signatur,
 * Tenant und Client-ID. Gleichzeitige Aufrufe teilen sich eine Anfrage;
 * klappt die stille Erneuerung nicht, geht es einmal über den Login zurück
 * auf dieselbe Seite (mit bestehender Microsoft-Sitzung ohne Eingabe). */
export async function getIdToken(forceRefresh = false) {
  if (DEMO) return "demo";
  if (pendingToken && !forceRefresh) return pendingToken;
  const request = (async () => {
    const account = await init();
    if (!account) throw new Error("Nicht angemeldet");
    try {
      const result = await client().acquireTokenSilent({ scopes: ["User.Read"], account, forceRefresh });
      return result.idToken;
    } catch (error) {
      if (!needsInteraction(error)) throw error;
      if (!redirecting) {
        redirecting = true;
        await client().acquireTokenRedirect({ scopes: ["User.Read"], extraScopesToConsent: PROFILE_SCOPES, account });
      }
      // Die Seite wird gerade zum Login weitergeleitet.
      return new Promise<string>(() => {});
    }
  })();
  pendingToken = request;
  try {
    return await request;
  } finally {
    if (pendingToken === request) pendingToken = null;
  }
}

export class ConsentRequiredError extends Error {
  constructor(public scopes: string[]) {
    super("Zustimmung für Microsoft 365 nötig");
  }
}

/** Zugriffstoken für Microsoft Graph. Fehlt die Zustimmung zu den Rechten,
 * kommt ConsentRequiredError; dann hilft requestConsent(). */
export async function getGraphToken(scopes: string[]) {
  const account = await init();
  if (!account) throw new Error("Nicht angemeldet");
  try {
    const result = await client().acquireTokenSilent({ scopes, account, forceRefresh: false });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) throw new ConsentRequiredError(scopes);
    throw error;
  }
}

export async function requestConsent(scopes: string[]) {
  const account = await init();
  await client().acquireTokenRedirect({ scopes, account: account ?? undefined });
}

const AuthContext = createContext<AuthState>({ status: "loading", account: null, error: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", account: null, error: null });

  useEffect(() => {
    if (DEMO) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- einmaliger Wechsel in den Vorschaumodus
      setState({ status: "signed-in", account: DEMO_ACCOUNT, error: null });
      return;
    }
    init()
      .then((account) =>
        setState(
          account
            ? { status: "signed-in", account: toAccount(account), error: null }
            : { status: "signed-out", account: null, error: null }
        )
      )
      .catch((error) =>
        setState({ status: "signed-out", account: null, error: authErrorMessage(error) })
      );
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function initials(name: string) {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
