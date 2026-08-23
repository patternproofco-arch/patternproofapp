interface Props {
  done: number;
  total: number;
  currentName: string | null;
  found: number;
}

export function OcrProgress({ done, total, currentName, found }: Props) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="card-pp" style={{ padding: 20 }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="exhibit-tag">READING ON THIS DEVICE</span>
        <span className="mono-meta mono-meta--muted">
          {done} / {total}
        </span>
      </div>
      <div
        className="mt-3"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading screenshots"
        style={{
          height: 6,
          background: "rgba(26,18,36,0.10)",
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--pp-ink)",
            transition: "width 240ms linear",
          }}
        />
      </div>
      <p className="mt-3" style={{ fontSize: 13.5, color: "rgba(26,18,36,0.7)" }}>
        {currentName ? `Reading ${currentName}…` : "Finishing up…"} Found {found} message
        {found === 1 ? "" : "s"} so far. Everything is saved as we go — you can close this tab and
        come back.
      </p>
    </div>
  );
}
