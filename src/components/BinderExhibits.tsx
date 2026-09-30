import type { BinderEntry } from "@/lib/binder";

/**
 * The full exhibit pages of a binder. Shared by the attorney's binder and the
 * survivor's own court timeline so both sides read the same document, with the
 * same exhibit numbers and the same wording.
 */
export function BinderExhibits({ entries }: { entries: BinderEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ol className="space-y-4">
      {entries.map((e) => (
        <BinderRow key={`${e.kind}-${e.id}`} entry={e} />
      ))}
    </ol>
  );
}

function BinderRow({ entry }: { entry: BinderEntry }) {
  return (
    <li className="break-inside-avoid rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {entry.exhibit} · {entry.label}
        </span>
        <span className="text-xs text-muted-foreground">{entry.date ?? "Date not given"}</span>
      </div>
      <h3 className="mt-1 font-medium">{entry.title}</h3>
      {entry.body && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>}
    </li>
  );
}
