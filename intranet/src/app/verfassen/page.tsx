import { Suspense } from "react";
import { ComposeWindow } from "@/components/sales/mail/compose-page";
import { mailboxesFor } from "@/lib/config";

export default function ComposePage() {
  // useSearchParams braucht eine Suspense-Grenze
  return (
    <Suspense>
      <ComposeWindow mailboxes={mailboxesFor("mail")} />
    </Suspense>
  );
}
