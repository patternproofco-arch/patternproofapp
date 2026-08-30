export type ThreadPersona = "survivor" | "attorney" | "org" | "shared";

interface ThreadConnectorProps {
  /** Which locked persona accent the thread reads. Defaults to the
   *  surrounding [data-persona] context, falling back to `shared`. */
  persona?: ThreadPersona;
  /** `vertical` connects stacked nodes; `horizontal` runs behind a card grid. */
  orientation?: "vertical" | "horizontal" | "vertical-behind";
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The single wavy "connecting thread" motif. Colors come only from the
 * locked --pp-accent-* tokens via --pp-thread-grad in src/styles.css.
 * Always decorative: aria-hidden and behind cards.
 */
const THREAD_CLASS = {
  vertical: "pp-thread-line",
  horizontal: "pp-thread-line-h",
  "vertical-behind": "pp-thread-line-v",
} as const;

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
      className={[THREAD_CLASS[orientation], className]
        .filter(Boolean)
        .join(" ")}
      style={style}
    />
  );
}

/** Wraps a group of cards so a horizontal thread can sit behind them. */
export function ThreadGroup({
  persona,
  orientation = "horizontal",
  className,
  style,
  children,
}: {
  persona?: ThreadPersona;
  orientation?: "horizontal" | "vertical-behind";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className={["pp-thread-group", className].filter(Boolean).join(" ")} style={style}>
      <ThreadConnector persona={persona} orientation={orientation} />
      {children}
    </div>
  );
}

export default ThreadConnector;
