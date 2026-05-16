import { typeColor, typeLabel } from "@/lib/abuse-types";

export interface IncidentLite {
  id: string;
  date: string;
  abuse_types: string[];
  description: string;
  location?: string | null;
}

export function IncidentCard({
  incident,
  actions,
}: {
  incident: IncidentLite;
  actions?: React.ReactNode;
}) {
  const primary = incident.abuse_types[0] ?? "other";
  return (
    <div
      className="card-pp"
      style={{ borderLeft: `3px solid ${typeColor(primary)}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="label-eyebrow">
              {new Date(incident.date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {incident.abuse_types.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{ background: typeColor(t), color: "#fff" }}
              >
                {typeLabel(t)}
              </span>
            ))}
          </div>
          <p className="line-clamp-2 text-[14px] leading-relaxed" style={{ color: "var(--foreground)" }}>
            {incident.description}
          </p>
          {incident.location && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              {incident.location}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}