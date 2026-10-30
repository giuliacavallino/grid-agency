"use client";

import { useMemo } from "react";
import { hasArea, isAdmin, type Member } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/data";

/** Eigene Rechte (Admin → Benutzer & Rechte) */
export function useMe() {
  const auth = useAuth();
  return useResource<Member>(auth.status === "signed-in" ? "/api/me" : null);
}

export function useCan(area: string) {
  const { data } = useMe();
  return hasArea(data, area);
}

export function useIsAdmin() {
  return isAdmin(useMe().data);
}

export type TeamMember = { email: string; name: string };

/** Aktive Teammitglieder für „Zuständig“ und Profilbilder */
export function useTeam() {
  const auth = useAuth();
  return useResource<TeamMember[]>(auth.status === "signed-in" ? "/api/team" : null).data ?? [];
}

export function useTeamNames() {
  const team = useTeam();
  return useMemo(() => team.map((m) => m.name), [team]);
}
