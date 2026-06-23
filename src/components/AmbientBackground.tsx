/**
 * Survivor app background — a soft, static iridescent gradient inspired by the
 * PatternProof survivor logo (pearly white with lavender + aqua bloom).
 * No particles, no animated pools — just a calm, premium wash that sits behind
 * all survivor-app content at z-index 0.
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
        background: [
          "radial-gradient(circle at 15% 20%, rgba(164, 255, 239, 0.35), transparent 32%)",
          "radial-gradient(circle at 85% 15%, rgba(196, 167, 255, 0.32), transparent 34%)",
          "radial-gradient(circle at 70% 80%, rgba(180, 255, 245, 0.22), transparent 36%)",
          "linear-gradient(135deg, #f8fbff 0%, #f3f0ff 42%, #ecfffb 100%)",
        ].join(", "),
      }}
    />
  );
}

export default AmbientBackground;