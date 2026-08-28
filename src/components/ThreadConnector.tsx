export type ThreadPersona = "survivor" | "attorney" | "org" | "shared";

interface ThreadConnectorProps {
  /** Which locked persona accent the thread reads. Defaults to the
   *  surrounding [data-persona] context, falling back to `shared`. */
  persona?: ThreadPersona;
  /** `vertical` connects stacked nodes; `horizontal` runs behind a card grid. */
  orientation?: "vertical" | "horizontal";
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The single wavy "connecting thread" motif. Colors come only from the
 * locked --pp-accent-* tokens via --pp-thread-grad in src/styles.css.
 * Always decorative: aria-hidden and behind cards.
 */
export function ThreadConnector({
  persona,
  orientation = "vertical",
  className,
  style,
}: ThreadConnectorProps) {
  return (
    <div
      aria-hidden="true"
      data-persona={persona}
      className={[orientation === "vertical" ? "pp-thread-line" : "pp-thread-line-h", className]
        .filter(Boolean)
        .join(" ")}
      style={style}
    />
  );
}

/** Wraps a group of cards so a horizontal thread can sit behind them. */
export function ThreadGroup({
  persona,
  className,
  style,
  children,
}: {
  persona?: ThreadPersona;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className={["pp-thread-group", className].filter(Boolean).join(" ")} style={style}>
      <ThreadConnector persona={persona} orientation="horizontal" />
      {children}
    </div>
  );
}

export default ThreadConnector;
