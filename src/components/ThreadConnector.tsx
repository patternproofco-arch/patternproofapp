import type { CSSProperties, ReactNode } from "react";

/**
 * The shared "wavy thread connecting cards" motif, colored per-portal via
 * `--pp-thread-grad` / `--pp-thread-grad-h` (see src/styles.css), which are
 * themselves scoped by the nearest ancestor `[data-persona="survivor" |
 * "attorney" | "org" | "shared"]`. Never hardcode a thread color inline —
 * set `data-persona` on a wrapping element instead, so the whole page's
 * accent, ground, and thread shift together.
 *
 * This unifies what used to be two separate hand-rolled implementations of
 * "a wavy line between cards" (raw `.pp-thread` / `.pp-thread-row` classes
 * used directly in JSX, each re-declaring the persona gradient inline) into
 * one component with one place to fix bugs or add orientations.
 */
export type ThreadOrientation = "vertical" | "horizontal" | "vertical-behind";

interface ThreadConnectorProps {
  /**
   * "vertical" — a numbered/step sequence, each item gets a node + card side
   * by side, connected top to bottom. Compose with <ThreadGroup>.
   * "horizontal" — the same, laid out left to right.
   * "vertical-behind" — a single line run behind a stack of full-width
   * cards with no node column; pass the cards directly as children.
   */
  orientation?: ThreadOrientation;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ThreadConnector({
  orientation = "vertical",
  children,
  className,
  style,
}: ThreadConnectorProps) {
  const variantClass =
    orientation === "horizontal"
      ? "pp-thread--h"
      : orientation === "vertical-behind"
        ? "pp-thread--behind"
        : undefined;
  return (
    <div className={["pp-thread", variantClass, className].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}

interface ThreadGroupProps {
  /** A number, icon, or dot rendered in the node marker. Omit for a plain connector with no marker. */
  node?: ReactNode;
  children: ReactNode;
  className?: string;
  nodeStyle?: CSSProperties;
}

/** One row/column in a "vertical" or "horizontal" ThreadConnector. Not used under "vertical-behind". */
export function ThreadGroup({ node, children, className, nodeStyle }: ThreadGroupProps) {
  return (
    <div className={["pp-thread-row", className].filter(Boolean).join(" ")}>
      {node !== undefined ? (
        <div className="pp-thread-node" style={nodeStyle}>
          {node}
        </div>
      ) : null}
      <div className="pp-thread-card">{children}</div>
    </div>
  );
}
