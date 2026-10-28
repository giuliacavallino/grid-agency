import { Suspense } from "react";
import type { Metadata } from "next";
import { Mailbox } from "@/components/sales/mail/mailbox";
import { mailboxesFor } from "@/lib/config";

export const metadata: Metadata = { title: "Posteingang" };

export default function PosteingangPage() {
  // useSearchParams (?to=) braucht eine Suspense-Grenze
  return (
    <Suspense>
      <Mailbox mailboxes={mailboxesFor("sales")} />
    </Suspense>
  );
}
