import type { ExifSummary } from "@/lib/exif";

export type ExifChoice = "none" | "kept" | "stripped";

interface Props {
  name: string;
  sizeLabel: string;
  typeLabel: string;
  statusLabel: string;
  exif: ExifSummary | null;
  choice: ExifChoice | null;
  onChoice: (c: ExifChoice) => void;
  onRemove?: () => void;
}

/**
 * One queued file, with its metadata decision. We never keep or remove
 * embedded photo metadata without asking — both directions are legitimate,
 * and only she knows whether this file might be shared later.
 */
export function FileIntakeRow({ name, sizeLabel, typeLabel, statusLabel, exif, choice, onChoice, onRemove }: Props) {
  const needsChoice = !!exif && (exif.hasGps || !!exif.capturedOn || exif.hasMetadata);

  return (
    <div className="rounded-xl p-2" style={{ background: "var(--input)" }}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px]" style={{ fontWeight: 600 }}>{name}</div>
          <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            {sizeLabel}{typeLabel ? ` · ${typeLabel}` : ""}{statusLabel}
          </div>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-[12px] underline" style={{ color: "var(--muted-foreground)" }}>
            Remove
          </button>
        )}
      </div>

      {needsChoice && (
        <div className="mt-2 rounded-lg p-2 text-[12px]" style={{ background: "rgba(231,208,163,0.35)", color: "#5a3a12" }}>
          <div style={{ fontWeight: 600 }}>
            This photo carries hidden details
            {exif?.capturedOn ? ` — taken ${exif.capturedOn}` : ""}
            {exif?.hasGps ? `${exif?.capturedOn ? ", and" : " —"} a location` : ""}.
          </div>
          <p className="mt-1" style={{ lineHeight: 1.5 }}>
            Keeping them can help show when and where a photo was taken. Removing them is safer if
            this file might ever be sent to or opened by someone else. Your choice — we won&apos;t decide
            for you.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChoice("kept")}
              className="btn-ghost text-[12px]"
              style={choice === "kept" ? { background: "rgba(168,216,185,0.5)" } : undefined}
            >
              Keep the details
            </button>
            <button
              type="button"
              onClick={() => onChoice("stripped")}
              className="btn-ghost text-[12px]"
              style={choice === "stripped" ? { background: "rgba(168,216,185,0.5)" } : undefined}
            >
              Remove them
            </button>
            {choice && (
              <span style={{ alignSelf: "center" }}>
                {choice === "kept" ? "Keeping them." : "They'll be removed before this uploads."}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
