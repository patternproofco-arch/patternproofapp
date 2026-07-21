import { typeColor, typeLabel } from "@/lib/abuse-types";
import { formatDateLocal } from "@/lib/dates";

export interface IncidentLite {
  id: string;
  date: string;
  abuse_types: string[];
  description: string;
  location?: string | null;
  source?: string | null;
  confirmed_at?: string | null;
}

export function IncidentCard({
  incident,
  actions,
  onConfirm,
}: {
  incident: IncidentLite;
  actions?: React.ReactNode;
  onConfirm?: (id: string) => void;
}) {
  const primary = incident.abuse_types[0] ?? "other";
  const needsConfirmation =
    incident.source === "ai_extracted" && !incident.confirmed_at;
  return (
    <div
      className="card-pp"
      style={{ borderLeft: `3px solid ${typeColor(primary)}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="label-eyebrow">
              {formatDateLocal(incident.date, { month: "short", day: "numeric", year: "numeric" })}
            </span>
            {needsConfirmation && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "#FFE4B5", color: "#7A4A00", border: "1px solid rgba(180,120,20,0.35)" }}
                title="Drafted by AI from an uploaded file. Please review and confirm."
              >
                ✎ Needs your confirmation
              </span>
            )}
            {incident.abuse_types.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{ background: typeColor(t), color: "#1A1714" }}
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
          {needsConfirmation && onConfirm && (
            <button
              type="button"
              onClick={() => onConfirm(incident.id)}
              className="mt-2 rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              Confirm this record
            </button>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}