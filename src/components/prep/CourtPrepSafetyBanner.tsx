import { useState } from "react";
import {
  EDUCATIONAL_DISCLAIMER,
  SAFETY_COPY_SHORT,
  SAFETY_COPY_STANDARD,
} from "@/lib/prep/constants";
import {
  getSafetyCopyVersion,
  setSafetyCopyVersion,
  type SafetyCopyVersion,
} from "@/lib/prep/session-county";

export function CourtPrepSafetyBanner({ compact = false }: { compact?: boolean }) {
  const [version, setVersion] = useState<SafetyCopyVersion>(() => getSafetyCopyVersion());

  const choose = (v: SafetyCopyVersion) => {
    setSafetyCopyVersion(v);
    setVersion(v);
  };

  const body = version === "short" ? SAFETY_COPY_SHORT : SAFETY_COPY_STANDARD;

  return (
    <aside
      className="rounded-2xl p-4 text-sm leading-relaxed"
      style={{
        background: "var(--pp-card)",
        boxShadow: "var(--pp-shadow-sm)",
        color: "var(--pp-ink)",
      }}
      role="note"
    >
      <p style={{ margin: 0, fontWeight: 600 }}>Educational preparation only</p>
      <p style={{ margin: "8px 0 0", color: "var(--pp-muted)" }}>{EDUCATIONAL_DISCLAIMER}</p>
      {!compact && (
        <>
          <div className="mt-3 flex flex-wrap gap-2 no-print" role="group" aria-label="Safety notice length">
            <button
              type="button"
              className="text-xs px-3 py-1 rounded-full border"
              style={{
                borderColor: "var(--pp-ink)",
                background: version === "standard" ? "var(--pp-ink)" : "transparent",
                color: version === "standard" ? "var(--pp-ground)" : "var(--pp-ink)",
              }}
              onClick={() => choose("standard")}
              aria-pressed={version === "standard"}
            >
              Detailed safety note
            </button>
            <button
              type="button"
              className="text-xs px-3 py-1 rounded-full border"
              style={{
                borderColor: "var(--pp-ink)",
                background: version === "short" ? "var(--pp-ink)" : "transparent",
                color: version === "short" ? "var(--pp-ground)" : "var(--pp-ink)",
              }}
              onClick={() => choose("short")}
              aria-pressed={version === "short"}
            >
              Short calm note
            </button>
          </div>
          <p style={{ margin: "12px 0 0", color: "var(--pp-muted)", fontSize: 13 }}>{body}</p>
        </>
      )}
    </aside>
  );
}
