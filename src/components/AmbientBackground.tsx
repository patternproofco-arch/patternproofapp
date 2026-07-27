/**
 * Survivor app background — flat paper. The locked design system has no
 * decorative gradients; the only gradient in the product is the survivor's own
 * highlight underline (.highlight-thread).
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: "var(--pp-paper)",
      }}
    />
  );
}

export default AmbientBackground;
