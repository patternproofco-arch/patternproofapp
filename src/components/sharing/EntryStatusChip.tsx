import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ENTRY_SHARE_CHIP_COPY,
  entryShareChip,
  type EntryShareChip as ChipKind,
  type ShareReadiness,
} from "@/lib/sharing/share-readiness";

export function EntryStatusChip({
  readiness,
  inActiveGrant,
  wasWithdrawn,
  onEditReadiness,
}: {
  readiness: ShareReadiness | string | null | undefined;
  inActiveGrant?: boolean;
  wasWithdrawn?: boolean;
  /** Opens Sharing readiness hinge when chip is tapped (kept private / OK / deciding). */
  onEditReadiness?: () => void;
}) {
  const kind = entryShareChip({ readiness, inActiveGrant, wasWithdrawn });
  const copy = ENTRY_SHARE_CHIP_COPY[kind];
  const [open, setOpen] = useState(false);

  const styles: Record<ChipKind, { bg: string; fg: string; border: string }> = {
    kept_private: {
      bg: "color-mix(in srgb, var(--pp-ink) 6%, white)",
      fg: "var(--pp-ink)",
      border: "color-mix(in srgb, var(--pp-ink) 18%, white)",
    },
    ok_to_share: {
      bg: "color-mix(in srgb, var(--pp-iridescent-teal) 14%, white)",
      fg: "var(--pp-ink)",
      border: "color-mix(in srgb, var(--pp-iridescent-teal) 40%, white)",
    },
    shared: {
      bg: "color-mix(in srgb, var(--pp-iridescent-violet) 14%, white)",
      fg: "var(--pp-ink)",
      border: "color-mix(in srgb, var(--pp-iridescent-violet) 40%, white)",
    },
    access_withdrawn: {
      bg: "color-mix(in srgb, var(--pp-muted) 12%, white)",
      fg: "var(--pp-muted)",
      border: "color-mix(in srgb, var(--pp-muted) 30%, white)",
    },
    still_deciding: {
      bg: "color-mix(in srgb, var(--pp-iridescent-pink) 12%, white)",
      fg: "var(--pp-ink)",
      border: "color-mix(in srgb, var(--pp-iridescent-pink) 35%, white)",
    },
  };
  const s = styles[kind];

  return (
    <span className="relative inline-flex flex-col items-start gap-1">
      <button
        type="button"
        data-testid="entry-status-chip"
        aria-label={copy.aria}
        className="rounded-2xl px-2 py-0.5 text-[10px] font-semibold"
        style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
        onClick={() => {
          setOpen((o) => !o);
          if (kind === "kept_private" || kind === "ok_to_share" || kind === "still_deciding") {
            onEditReadiness?.();
          }
        }}
      >
        {copy.label}
      </button>
      {open && (
        <span
          role="status"
          className="max-w-[220px] rounded-lg border bg-background px-2 py-1.5 text-[11px] shadow-sm"
          style={{ color: "var(--pp-muted)", borderColor: "var(--border)" }}
        >
          {copy.explainer}
          {(kind === "shared" || kind === "access_withdrawn") && (
            <>
              {" "}
              <Link to="/access" className="underline" style={{ color: "var(--pp-ink)" }}>
                What I shared
              </Link>
            </>
          )}
        </span>
      )}
    </span>
  );
}
