import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

interface FocusModeValue {
  focusId: string | null;
  focus: (id: string) => void;
  clear: () => void;
}

const FocusModeContext = createContext<FocusModeValue>({
  focusId: null,
  focus: () => {},
  clear: () => {},
});

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
export function FocusModeProvider({
  children,
  accentColor = "var(--pp-ink)",
}: {
  children: ReactNode;
  accentColor?: string;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  void accentColor;

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
export function FocusRegion({
  id,
  children,
  neverDim = false,
  style,
  className,
}: FocusRegionProps) {
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

/** "Show everything" for focus mode: rendered inline at the end of the page
 *  content (inside <main>, above the nav's reserved space). Never fixed. */
export function FocusReveal() {
  const ctx = useContext(FocusModeContext);
  const focusId = ctx?.focusId ?? null;
  const clear = ctx?.clear ?? (() => {});
  return (
    <>
      {focusId ? (
        // Inline, below the page content: never fixed or overlaid on controls.
        <div
          className="no-print pp-focus-reveal"
          data-testid="focus-show-everything"
          style={{ display: "flex", justifyContent: "center", padding: "24px 0 8px" }}
        >
          <button
            type="button"
            onClick={clear}
            style={{
              minHeight: 44,
              border: "1px solid var(--pp2-ink, #2b2134)",
              background: "transparent",
              borderRadius: 999,
              padding: "0 16px",
              fontSize: 14,
              color: "var(--pp2-ink, #2b2134)",
            }}
          >
            Show everything
          </button>
        </div>
      ) : null}
    </>
  );
}
