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

/** Initialisiert MSAL einmal und verarbeitet die Rückkehr vom Login. */
function init() {
  if (!ready) {
    ready = (async () => {
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

/** Leitet zum Microsoft-Login weiter; danach geht es zur aktuellen Seite zurück. */
export async function signIn(request: Partial<RedirectRequest> = {}) {
  await init();
  await client().loginRedirect({ scopes: ["User.Read"], ...request });
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

/** ID-Token für die eigenen API-Routen. Der Server prüft Signatur,
 * Tenant und Client-ID. */
export async function getIdToken(forceRefresh = false) {
  if (DEMO) return "demo";
  const account = await init();
  if (!account) throw new Error("Nicht angemeldet");
  const result = await client().acquireTokenSilent({
    scopes: ["User.Read"],
    account,
    forceRefresh,
  });
  return result.idToken;
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
