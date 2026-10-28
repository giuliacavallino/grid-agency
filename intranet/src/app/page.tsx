"use client";

import { Hub } from "@/components/hub";
import { RequireAuth } from "@/components/login";

export default function Home() {
  return (
    <RequireAuth>
      <Hub />
    </RequireAuth>
  );
}
