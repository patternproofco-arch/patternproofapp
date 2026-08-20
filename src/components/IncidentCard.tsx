import { MapPin, Paperclip } from "lucide-react";
import { typeColor, typeLabel } from "@/lib/abuse-types";
import { formatIncidentDate, dateConfidence } from "@/lib/dates";

export interface IncidentLite {
  id: string;
  date: string | null;
  abuse_types: string[];
  description: string;
  location?: string | null;
  source?: string | null;
  confirmed_at?: string | null;
  date_precision?: string | null;
  date_range_start?: string | null;
  date_range_end?: string | null;
  anchor_incident_id?: string | null;
  anchor_label?: string | null;
  anchor_incident?: { date?: string | null; description?: string | null } | null;
  time?: string | null;
  witnesses?: string | null;
  emotional_impact?: string | null;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  approximate: "Approximate",
  unknown: "Undated",
};

/** Most severe category wins the rail — order here doubles as severity rank. */
const SEVERITY_ORDER = [
  "sexual",
  "physical",
  "threats",
  "stalking",
  "digital_intimidation",
  "coercive",
  "surveillance",
  "location_tracking",
  "account_control",
  "smart_home",
  "impersonation",
  "harassment",
  "child",
  "legal",
  "property",
  "digital",
  "financial",
  "verbal",
];

function mostSevere(types: string[]): string {
  if (types.length === 0) return "other";
  const ranked = [...types].sort((a, b) => {
    const ai = SEVERITY_ORDER.indexOf(a);
    const bi = SEVERITY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  return ranked[0];
}

export function IncidentCard({
  incident,
  actions,
  onConfirm,
  evidenceCount = 0,
}: {
  incident: IncidentLite;
  actions?: React.ReactNode;
  onConfirm?: (id: string) => void;
  evidenceCount?: number;
}) {
  const rail = typeColor(mostSevere(incident.abuse_types));
  const confidence = dateConfidence(incident.date_precision);
  const needsConfirmation = incident.source === "ai_extracted" && !incident.confirmed_at;
  return (
    <div className="card-pp" style={{ borderLeft: `3px solid ${rail}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* 1–3 · date · time · confidence, location right-aligned */}
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-bold" style={{ color: "var(--pp-ink)" }}>
                {formatIncidentDate(incident)}
                {incident.time ? ` · ${incident.time}` : ""}
              </span>
              {confidence !== "confirmed" && (
                <span className="label-eyebrow" style={{ color: "var(--pp-muted)" }}>
                  {CONFIDENCE_LABEL[confidence]}
                </span>
              )}
              {needsConfirmation && (
                <span
                  className="rounded-2xl px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: "#FFE4B5",
                    color: "#7A4A00",
                    border: "1px solid rgba(180,120,20,0.35)",
                  }}
                  title="Drafted by AI from an uploaded file. Please review and confirm."
                >
                  ✎ Needs your confirmation
                </span>
              )}
            </span>
            {incident.location && (
              <span
                className="flex shrink-0 items-center gap-1 text-[12px]"
                style={{ color: "var(--pp-muted)" }}
              >
                <MapPin size={12} />
                {incident.location}
              </span>
            )}
          </div>

          {/* 4 · Categories — carved pill, coloured text + dot, never a tinted fill */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {incident.abuse_types.slice(0, 4).map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: "var(--pp-card)",
                  boxShadow: "var(--pp-shadow-in-sm)",
                  color: typeColor(t),
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: typeColor(t),
                    display: "inline-block",
                  }}
                />
                {typeLabel(t)}
              </span>
            ))}
          </div>

          {/* 5 · Account — the survivor's own words, never paraphrased */}
          <p
            className="line-clamp-2 text-[14px] leading-relaxed"
            style={{ color: "var(--foreground)" }}
          >
            {incident.description}
          </p>

          {/* 6 · Witnesses */}
          {incident.witnesses && (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--pp-muted)" }}>
              <b style={{ color: "var(--pp-ink)" }}>Witnesses:</b> {incident.witnesses}
            </p>
          )}

          {/* 7 · Impact — the aftermath, not the event; always quoted, never edited */}
          {incident.emotional_impact && (
            <p
              className="mt-2 text-[12.5px] italic leading-relaxed"
              style={{ color: "var(--pp-muted)" }}
            >
              “{incident.emotional_impact}”
            </p>
          )}

          {/* 8 · Evidence — dotted rule, one chip per attachment */}
          {evidenceCount > 0 && (
            <>
              <div
                className="my-3"
                style={{
                  height: 1,
                  opacity: 0.5,
                  background:
                    "repeating-linear-gradient(90deg, var(--pp-muted) 0 3px, transparent 3px 7px)",
                }}
              />
              <span
                className="inline-flex items-center gap-1.5 text-[11.5px] font-medium"
                style={{ color: "var(--pp-muted)" }}
              >
                <Paperclip size={11} />
                {evidenceCount} {evidenceCount === 1 ? "attachment" : "attachments"}
              </span>
            </>
          )}

          {needsConfirmation && onConfirm && (
            <button
              type="button"
              onClick={() => onConfirm(incident.id)}
              className="mt-2 rounded-2xl px-3 py-1 text-[11px] font-semibold"
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
