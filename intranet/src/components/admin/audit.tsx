"use client";

import { useResource } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import type { VaultLogEntry } from "@/lib/vault";
import { Empty, Spinner } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";

/** Wer hat wann welches Passwort angezeigt, kopiert oder geändert. */
export function Audit() {
  const log = useResource<VaultLogEntry[]>("/api/audit/vault");
  return (
    <div className="flex h-full flex-col">
      <PageBar title="Protokoll" meta="Letzte 200 Zugriffe auf Passwörter" />
      {log.error ? (
        <Empty title="Protokoll konnte nicht geladen werden" text={log.error.message} />
      ) : log.loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : !log.data?.length ? (
        <Empty title="Noch keine Zugriffe" />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-10">
          <table className="w-full text-left text-[13.5px]">
            <thead className="sticky top-0 bg-canvas text-[12px] text-snow/55">
              <tr className="border-b border-snow/[0.08]">
                <th className="px-3 py-2 font-normal md:pl-6">Zeit</th>
                <th className="px-3 py-2 font-normal">Person</th>
                <th className="px-3 py-2 font-normal">Zugang</th>
                <th className="px-3 py-2 font-normal">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {log.data.map((entry) => (
                <tr key={entry.id} className="border-b border-snow/[0.06]">
                  <td className="px-3 py-2 whitespace-nowrap text-snow/65 md:pl-6">{formatDateTime(entry.at)}</td>
                  <td className="px-3 py-2">{entry.user_email}</td>
                  <td className="px-3 py-2">{entry.item_title ?? "–"}</td>
                  <td className="px-3 py-2 text-snow/75">{entry.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
