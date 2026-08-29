import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

interface FocusModeValue {
  focusId: string | null;
  focus: (id: string) => void;
  clear: () => void;
}

const FocusModeContext = createContext<FocusModeValue>({ focusId: null, focus: () => {}, clear: () => {} });

export function useFocusMode() {
  return useContext(FocusModeContext);
}

/**
 * Softly dims everything except the region being worked in.
 * Survivor portal: a calm mode. Attorney/advocate portals: a document-review /
 * triage concentration mode — same component, same behavior, portal accent.
 * Mounted at the shell level around page content only — Quick Exit, the
 * bottom tab bar and any other persistent safety chrome live outside this
 * provider and are never dimmed, blurred or covered.
 */
export function FocusModeProvider({ children, accentColor = "var(--pp-ink)" }: { children: ReactNode; accentColor?: string }) {
  const [focusId, setFocusId] = useState<string | null>(null);

  const focus = useCallback((id: string) => setFocusId(id), []);
  const clear = useCallback(() => setFocusId(null), []);

  useEffect(() => {
    if (!focusId) return;
    const onKey = (e: KeyboardEvent) => {
      // Single Esc backs out of focus. Double-Esc quick exit still works:
      // the shell listener runs independently.
      if (e.key === "Escape") setFocusId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusId]);

  const value = useMemo(() => ({ focusId, focus, clear }), [focusId, focus, clear]);

  return (
    <FocusModeContext.Provider value={value}>
      {focusId ? (
        <div
          className="no-print"
          style={{ position: "sticky", top: 8, zIndex: 5, display: "flex", justifyContent: "flex-end", padding: "0 20px" }}
        >
          <button
            type="button"
            onClick={clear}
            style={{
              border: "1px solid rgba(26,18,36,0.16)",
              background: "rgba(255,255,255,0.92)",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12.5,
              color: accentColor,
            }}
          >
            Show everything
          </button>
        </div>
      ) : null}
      {children}
    </FocusModeContext.Provider>
  );
}

interface FocusRegionProps {
  id: string;
  children: ReactNode;
  /** Never dimmed — use for anything holding a safety link (Safety Plan, Quick Exit). */
  neverDim?: boolean;
  style?: CSSProperties;
  className?: string;
}

/** A card/section that comes forward when she works in it. */
export function FocusRegion({ id, children, neverDim = false, style, className }: FocusRegionProps) {
  const { focusId, focus } = useFocusMode();
  const dimmed = !neverDim && focusId !== null && focusId !== id;

  return (
    <div
      className={className}
      data-focus-region={id}
      data-focus-dimmed={dimmed ? "true" : undefined}
      onPointerDownCapture={() => focus(id)}
      onFocusCapture={() => focus(id)}
      style={{
        transition: "filter 220ms ease, opacity 220ms ease",
        filter: dimmed ? "blur(1.6px)" : undefined,
        opacity: dimmed ? 0.42 : 1,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
