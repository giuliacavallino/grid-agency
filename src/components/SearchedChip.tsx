/** Grüner Chip an Stellen, die wir gerade aktiv besetzen wollen
 * (Intranet → Personal → Stellen). */
export function SearchedChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[0.6875rem] font-medium text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Wird gesucht
    </span>
  );
}
