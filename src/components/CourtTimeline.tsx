import type { BinderEntry } from "@/lib/binder";

interface CourtTimelineProps {
  entries: BinderEntry[];
}

/** Compact date-ordered list; same exhibit numbers as the binder. */
export function CourtTimeline({ entries }: CourtTimelineProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing has been shared yet.</p>;
  }
  return (
    <ol className="border-l-2 border-border pl-4">
      {entries.map((e) => (
        <li key={`${e.kind}-${e.id}`} className="relative mb-3 break-inside-avoid">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
          <div className="text-xs text-muted-foreground">
            {e.date ?? "Date not given"} · {e.exhibit} · {e.label}
          </div>
          <div className="text-sm font-medium">{e.title}</div>
        </li>
      ))}
    </ol>
  );
}
