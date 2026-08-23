import { useState } from "react";
import { Trash2, AlertTriangle, Link2 } from "lucide-react";
import { formatDateLocal } from "@/lib/dates";
import { channelMeta, type Comm, type IncidentLite } from "./types";

interface Props {
  comm: Comm;
  screenshotUrl?: string;
  incident?: IncidentLite;
  onRemove: () => void;
  onOpenIncident?: (id: string) => void;
}

export function CommCard({ comm, screenshotUrl, incident, onRemove, onOpenIncident }: Props) {
  const meta = channelMeta(comm.channel);
  const Icon = meta.Icon;
  const [armDelete, setArmDelete] = useState(false);
  const borderColor = comm.harassment_flag ? "var(--primary)" : meta.accentVar;

  return (
    <div className="card-pp" style={{ borderLeft: `3px solid ${borderColor}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="label-eyebrow">{formatDateLocal(comm.date)}{comm.time && ` · ${comm.time.slice(0, 5)}`}</span>
            <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--accent)", color: "#1A1714" }}>
              <Icon size={11} /> {meta.label}
            </span>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize" style={{ background: "var(--panel)", color: "#FFFFFF" }}>{comm.direction}</span>
            {comm.harassment_flag && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--primary)", color: "var(--pp-accent-fg, #fff)" }}>
                <AlertTriangle size={10} /> Harassment
              </span>
            )}
            {incident && (
              <button type="button" onClick={() => onOpenIncident?.(incident.id)}
                className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold hover:opacity-80"
                style={{ background: "var(--secondary)", color: "#1A1714" }}>
                <Link2 size={10} /> Linked · {formatDateLocal(incident.date)}
              </button>
            )}
          </div>
          {comm.from_party && <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>From: {comm.from_party}</p>}
          {comm.content && <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed">{comm.content}</p>}
          {comm.notes && <p className="mt-2 text-[12px] italic" style={{ color: "var(--muted-foreground)" }}>{comm.notes}</p>}
          {screenshotUrl && <img src={screenshotUrl} alt="Screenshot" className="mt-3 max-h-64 rounded-lg" />}
        </div>
        <button
          onClick={() => { if (armDelete) onRemove(); else setArmDelete(true); }}
          onBlur={() => setArmDelete(false)}
          aria-label={armDelete ? "Tap again to remove" : "Remove"}
          className="shrink-0 rounded-lg p-2 text-[11px] font-semibold hover:bg-black/5"
          style={{ color: armDelete ? "var(--primary)" : "var(--foreground)" }}>
          {armDelete ? "Tap to confirm" : <Trash2 size={15} />}
        </button>
      </div>
    </div>
  );
}