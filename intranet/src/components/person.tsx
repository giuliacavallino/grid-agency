"use client";

import { useEffect, useState } from "react";
import { ConsentRequiredError, getGraphToken, useAuth } from "@/lib/auth";
import { DEMO } from "@/lib/config";
import { useTeam } from "./access";
import { cn as clsx } from "@/lib/cn";
import { Avatar } from "./ui";

// Profilbilder aus Microsoft 365 (dieselben wie in Teams und Outlook).
// Fremde Bilder brauchen User.ReadBasic.All (Zustimmung beim Login), das
// eigene geht immer über /me. Ohne Bild bleiben die Initialen.

const GRAPH = "https://graph.microsoft.com/v1.0";
const cache = new Map<string, Promise<string | null>>();

async function fetchPhoto(path: string, scopes: string[]) {
  const token = await getGraphToken(scopes);
  const response = await fetch(`${GRAPH}${path}/photos/96x96/$value`, { headers: { Authorization: `Bearer ${token}` } });
  return response.ok ? URL.createObjectURL(await response.blob()) : null;
}

function loadPhoto(email: string, self: boolean) {
  const key = email.toLowerCase();
  let photo = cache.get(key);
  if (!photo) {
    photo = (async () => {
      if (DEMO) return null;
      try {
        return await fetchPhoto(`/users/${encodeURIComponent(key)}`, ["User.ReadBasic.All"]);
      } catch (error) {
        if (self && error instanceof ConsentRequiredError) return fetchPhoto("/me", ["User.Read"]).catch(() => null);
        return null;
      }
    })();
    cache.set(key, photo);
  }
  return photo;
}

/** Profilbild-URL zu einer E-Mail-Adresse (oder null, solange keins da ist) */
export function usePhoto(email: string | null | undefined) {
  const auth = useAuth();
  const self = auth.status === "signed-in" && auth.account.email.toLowerCase() === email?.toLowerCase();
  const [photo, setPhoto] = useState<{ email: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!email) return;
    let alive = true;
    loadPhoto(email, self).then((url) => alive && setPhoto({ email, url }));
    return () => {
      alive = false;
    };
  }, [email, self]);
  return photo && photo.email === email ? photo.url : null;
}

/** Avatar mit Microsoft-365-Profilbild; erkennt Teammitglieder am Namen. */
export function PersonAvatar({ name, email, className }: { name: string; email?: string; className?: string }) {
  const team = useTeam();
  const address = email ?? team.find((p) => p.name === name)?.email;
  const photo = usePhoto(address);
  if (!photo) return <Avatar name={name} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Blob-URL aus Microsoft Graph
    <img src={photo} alt="" aria-hidden className={clsx("inline-block h-8 w-8 shrink-0 rounded-full object-cover", className)} />
  );
}
