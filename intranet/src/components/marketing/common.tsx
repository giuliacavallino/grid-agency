"use client";

import { useEffect } from "react";
import { cn as clsx } from "@/lib/cn";
import { useResource } from "@/lib/data";
import { PROVIDERS, type ConnectProvider, type Provider, type SocialAccount } from "@/lib/marketing";
import { accentFill, accentText } from "@/lib/theme";
import { useToast } from "@/components/ui";

export type MarketingStatus = {
  configured: Record<ConnectProvider, boolean>;
  env: Record<ConnectProvider, string>;
  vault: boolean;
  agent: boolean;
  canva: SocialAccount | null;
};

export const useMarketingStatus = () => useResource<MarketingStatus>("/api/marketing/status");

const SHORT: Record<Provider, string> = { canva: "Ca", linkedin: "in", facebook: "f", instagram: "IG", tiktok: "TT" };

/** Kleines Kanal-Symbol in der Farbe der Plattform */
export function ProviderMark({ provider, className }: { provider: Provider; className?: string }) {
  const { color, label } = PROVIDERS[provider];
  return (
    <span
      title={label}
      aria-label={label}
      className={clsx("inline-grid h-6 min-w-6 place-items-center rounded-md px-1 text-[10.5px] font-semibold", className)}
      style={{ background: accentFill(color, 18), color: accentText(color) }}
    >
      {SHORT[provider]}
    </span>
  );
}

export function AccountLine({ account, children }: { account: SocialAccount; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-snow/[0.06] px-4 py-3 md:px-6">
      <ProviderMark provider={account.provider} />
      {account.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- Profilbild der Plattform
        <img src={account.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-medium">{account.name}</p>
        <p className={clsx("truncate text-[12.5px]", account.status === "error" ? "text-error" : "text-snow/55")}>
          {account.status === "error" ? account.error : [PROVIDERS[account.provider].label, account.handle].filter(Boolean).join(" · ")}
        </p>
      </div>
      {children}
    </div>
  );
}

/** Rückmeldung nach dem Verbinden (?connected=… / ?error=…) einmal anzeigen */
export function useConnectFeedback(onConnected?: () => void) {
  const toast = useToast();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (!connected && !error) return;
    if (connected) {
      toast("Verbunden");
      onConnected?.();
    } else toast(error ?? "Verbinden fehlgeschlagen", "error");
    params.delete("connected");
    params.delete("error");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [toast, onConnected]);
}
