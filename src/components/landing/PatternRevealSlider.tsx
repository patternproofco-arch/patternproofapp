import { useEffect, useMemo, useRef } from "react";
import { Slider } from "@/components/ui/slider";

interface Props {
  value: number;
  onChange: (v: number) => void;
}

const PALETTE = [
  "#C4B0E8", // purple light
  "#7C5CC4", // purple dark
  "#9ED8D0", // teal light
  "#3FAFA3", // teal dark
  "#F4C77B", // warm gold
  "#E77B56", // terracotta
  "#A8D8B9", // muted green
  "#6A92D6", // slate blue
];

interface Particle {
  // home (float) position
  hx: number;
  hy: number;
  // target (text) position
  tx: number;
  ty: number;
  // current
  x: number;
  y: number;
  // wander phase
  px: number;
  py: number;
  sx: number; // speed x
  sy: number;
  ax: number; // amplitude
  ay: number;
  r: number;
  color: string;
}

/**
 * Visual slider: floating colorful particles drift on the left.
 * As the user drags toward "Pattern", they coalesce into the words
 * "FIND THE PATTERN".
 */
export function PatternRevealSlider({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(value / 100);
  const particlesRef = useRef<Particle[]>([]);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  // Keep latest progress accessible to RAF loop without restarting it
  useEffect(() => {
    progressRef.current = value / 100;
  }, [value]);

  // Sample text pixels to build target points for particles
  const sampleTargets = useMemo(
    () =>
      (w: number, h: number): { x: number; y: number }[] => {
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const ctx = off.getContext("2d");
        if (!ctx) return [];
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Scale font to width
        const fontSize = Math.min(Math.floor(w / 9), Math.floor(h / 3.2));
        ctx.font = `800 ${fontSize}px Georgia, "Palatino Linotype", serif`;
        ctx.fillText("FIND THE PATTERN", w / 2, h / 2);
        const data = ctx.getImageData(0, 0, w, h).data;
        const pts: { x: number; y: number }[] = [];
        const step = 4; // density
        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const a = data[(y * w + x) * 4 + 3];
            if (a > 128) pts.push({ x, y });
          }
        }
        return pts;
      },
    [],
  );

  // Build / rebuild particles on size change
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const setup = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      if (rect.width < 8 || rect.height < 8) {
        // Container not laid out yet — wait for ResizeObserver to fire with real dims
        return;
      }
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sizeRef.current = { w, h, dpr };

      const targets = sampleTargets(w, h);
      const count = Math.min(targets.length, 380);
      // Evenly sample target points
      const stride = targets.length / count;
      const particles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const t = targets[Math.floor(i * stride)] ?? { x: w / 2, y: h / 2 };
        const hx = Math.random() * w;
        const hy = Math.random() * h;
        particles.push({
          hx,
          hy,
          tx: t.x,
          ty: t.y,
          x: hx,
          y: hy,
          px: Math.random() * Math.PI * 2,
          py: Math.random() * Math.PI * 2,
          sx: 0.4 + Math.random() * 0.8,
          sy: 0.4 + Math.random() * 0.8,
          ax: 8 + Math.random() * 22,
          ay: 6 + Math.random() * 18,
          r: 1.2 + Math.random() * 1.8,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        });
      }
      particlesRef.current = particles;
    };

    setup();
    const ro = new ResizeObserver(setup);
    ro.observe(container);
    return () => ro.disconnect();
  }, [sampleTargets]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h, dpr } = sizeRef.current;
      const p = progressRef.current;
      // Eased coalescence
      const k = p * p * (3 - 2 * p); // smoothstep

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const t = now / 1000;
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const pt = particles[i];
        pt.px += dt * pt.sx;
        pt.py += dt * pt.sy;
        const floatX = pt.hx + Math.cos(pt.px) * pt.ax;
        const floatY = pt.hy + Math.sin(pt.py) * pt.ay;
        // tiny shimmer near target so it still feels alive
        const shimmer = 0.6;
        const targetX = pt.tx + Math.cos(t * 2 + i) * shimmer;
        const targetY = pt.ty + Math.sin(t * 2 + i) * shimmer;
        pt.x = floatX + (targetX - floatX) * k;
        pt.y = floatY + (targetY - floatY) * k;

        ctx.beginPath();
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = 0.55 + 0.45 * Math.max(k, 0.4);
        const r = pt.r * (1 + k * 0.6);
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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
        ref={containerRef}
        style={{
          position: "relative",
          height: 220,
          borderRadius: 16,
          overflow: "hidden",
          background:
            "linear-gradient(135deg, rgba(196,176,232,0.10), rgba(158,216,208,0.10))",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
          aria-hidden
        />
        <span className="sr-only">
          Slide right to reveal the phrase Find the Pattern formed from floating particles.
        </span>
      </div>
      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700, whiteSpace: "nowrap" }}>
          Without PatternProof
        </span>
        <Slider
          value={[value]}
          onValueChange={(v) => onChange(v[0] ?? 0)}
          min={0}
          max={100}
          step={1}
          aria-label="Reveal the pattern"
        />
        <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--foreground)", fontWeight: 700, whiteSpace: "nowrap" }}>
          With PatternProof
        </span>
      </div>
    </div>
  );
}