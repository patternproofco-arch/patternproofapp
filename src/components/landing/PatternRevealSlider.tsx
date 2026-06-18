import { Slider } from "@/components/ui/slider";

interface Props {
  value: number;
  onChange: (v: number) => void;
}

/**
 * Visual slider: left side = scattered glyphs; right side = ordered timeline that
 * resolves to "FIND THE PATTERNS". CSS-only animation driven by the slider value.
 */
export function PatternRevealSlider({ value, onChange }: Props) {
  const p = value / 100;
  // Scatter offset shrinks as p -> 1
  const scatter = (seed: number) => {
    const s = Math.sin(seed * 12.345) * 43.21;
    const frac = s - Math.floor(s);
    return (frac - 0.5) * 120 * (1 - p);
  };
  const glyphs = ["📱", "✉️", "📷", "🎙", "📝", "🕒", "📍", "👁", "•", "•", "•", "•", "•", "•"];

  return (
    <div
      style={{
        position: "relative",
        background: "#FFFFFF",
        border: "1px solid var(--border)",
        borderRadius: 24,
        padding: 24,
        boxShadow: "0 10px 40px rgba(124,92,196,0.08)",
      }}
    >
      <div
        style={{
          position: "relative",
          height: 220,
          borderRadius: 16,
          overflow: "hidden",
          background:
            "linear-gradient(135deg, rgba(196,176,232,0.10), rgba(158,216,208,0.10))",
        }}
      >
        {/* Scattered glyphs / aligning dots */}
        {glyphs.map((g, i) => {
          const baseX = 10 + (i / glyphs.length) * 90; // % across when aligned
          const baseY = 50;
          const dx = scatter(i + 1);
          const dy = scatter(i + 7);
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                left: `${baseX}%`,
                top: `${baseY}%`,
                transform: `translate(${dx}px, ${dy}px) translate(-50%, -50%)`,
                fontSize: g === "•" ? 18 : 18,
                color: g === "•" ? "var(--purple-dark)" : undefined,
                opacity: 0.7 + 0.3 * p,
                transition: "transform 0.15s ease, opacity 0.15s ease",
              }}
              aria-hidden
            >
              {g}
            </span>
          );
        })}
        {/* Resolved text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: Math.max(0, (p - 0.6) / 0.4),
            transition: "opacity 0.2s ease",
            fontWeight: 800,
            letterSpacing: "0.12em",
            fontSize: 22,
            background: "linear-gradient(90deg, var(--teal-dark), var(--purple-dark))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          FIND THE PATTERNS
        </div>
        {/* Timeline rail */}
        <div
          style={{
            position: "absolute",
            left: "5%",
            right: "5%",
            bottom: "20%",
            height: 2,
            background: "linear-gradient(90deg, transparent, var(--purple-dark), transparent)",
            opacity: p,
            transition: "opacity 0.2s ease",
          }}
        />
      </div>
      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 600 }}>Scattered</span>
        <Slider
          value={[value]}
          onValueChange={(v) => onChange(v[0] ?? 0)}
          min={0}
          max={100}
          step={1}
          aria-label="Reveal pattern"
        />
        <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 600 }}>Pattern</span>
      </div>
    </div>
  );
}