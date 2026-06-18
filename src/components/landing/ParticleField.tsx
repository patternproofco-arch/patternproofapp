import { useEffect, useRef } from "react";

interface Props {
  height?: number;
  /** "scatter" = drifting dots; "converge" = particles slowly group toward center */
  mode?: "scatter" | "converge";
  colors?: string[];
}

/**
 * Lightweight canvas particle field used in landing hero + slider previews.
 * Respects prefers-reduced-motion.
 */
export function ParticleField({
  height = 240,
  mode = "scatter",
  colors = ["#9ED8D0", "#C4B0E8", "#B5C7F0", "#BDE6D4", "#D8C8F0"],
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const parent = canvas.parentElement!;
    const resize = () => {
      const w = parent.clientWidth;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const count = reduced ? 30 : 80;
    const particles = Array.from({ length: count }).map(() => ({
      x: Math.random() * parent.clientWidth,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: 1.5 + Math.random() * 2.5,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));

    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.005;
      const w = parent.clientWidth;
      ctx.clearRect(0, 0, w, height);
      for (const p of particles) {
        if (mode === "converge") {
          const cx = w / 2;
          const cy = height / 2;
          const pull = 0.0008 + 0.0006 * Math.sin(t);
          p.vx += (cx - p.x) * pull;
          p.vy += (cy - p.y) * pull;
          p.vx *= 0.96;
          p.vy *= 0.96;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        ctx.beginPath();
        ctx.fillStyle = p.c;
        ctx.globalAlpha = 0.6;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [height, mode, colors]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height,
        pointerEvents: "none",
        zIndex: 1,
        opacity: 0.9,
      }}
    />
  );
}