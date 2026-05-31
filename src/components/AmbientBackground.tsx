import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Living Canvas background — soft drifting pastel gradient pools plus
 * a thin layer of slowly rising particles. Sits behind all app content
 * at z-index 0. Honours prefers-reduced-motion.
 */
export function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Per-page tint hint via data-page on <body>.
  useEffect(() => {
    if (typeof document === "undefined") return;
    let key = "default";
    if (pathname.startsWith("/journal")) key = "log";
    else if (pathname.startsWith("/timeline")) key = "timeline";
    else if (pathname.startsWith("/voice-notes") || pathname.startsWith("/live-recording")) key = "voice";
    else if (pathname.startsWith("/share-with-attorney") || pathname.startsWith("/attorney-portal")) key = "attorney";
    else if (pathname.startsWith("/patterns")) key = "patterns";
    document.body.setAttribute("data-page", key);
    return () => { /* keep last value on unmount */ };
  }, [pathname]);

  useEffect(() => {
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const colors = [
      [232, 160, 180],
      [196, 176, 216],
      [168, 204, 224],
      [240, 223, 160],
      [200, 212, 192],
    ];

    type P = {
      x: number; y: number; r: number;
      vy: number; phase: number; ampl: number;
      colorIdx: number;
      pulseOffset: number; pulsePeriod: number;
    };
    let particles: P[] = [];

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      particles = Array.from({ length: 28 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 3 + Math.random() * 4,
        vy: 0.15 + Math.random() * 0.20,
        phase: Math.random() * Math.PI * 2,
        ampl: 0.4 + Math.random() * 0.4,
        colorIdx: Math.floor(Math.random() * colors.length),
        pulseOffset: Math.random() * Math.PI * 2,
        pulsePeriod: 4000 + Math.random() * 4000,
      }));
    };

    resize(); seed();
    window.addEventListener("resize", resize);

    const tick = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.y -= p.vy;
        p.phase += 0.01;
        const x = p.x + Math.sin(p.phase) * p.ampl;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        const pulse = 0.3 + (Math.sin((t + p.pulseOffset) / (p.pulsePeriod / (Math.PI * 2))) + 1) * 0.15;
        const [r, g, b] = colors[p.colorIdx];
        ctx.beginPath();
        ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${pulse.toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <div className="bg-pool-1" aria-hidden />
      <div className="bg-pool-2" aria-hidden />
      <canvas ref={canvasRef} className="bg-particles" aria-hidden />
    </>
  );
}

export default AmbientBackground;