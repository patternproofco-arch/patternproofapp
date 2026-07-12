import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, NotebookPen, Mic, MoreHorizontal,
  Files, BookOpen, Scale,
  Settings as SettingsIcon, LogOut, X,
  PanelLeftClose, PanelLeftOpen, GripVertical, EyeOff, Eye,
  Search as SearchIcon, MessageSquare,
} from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NavIcon } from "@/components/NavIcon";
import { useDraggable } from "@/hooks/use-draggable";
import {
  TimelineDotsIcon, DotCirclePatternIcon, PpTriangleIcon, CourtSummaryIcon,
} from "@/components/icons/PpIcons";

/**
 * PrismIcon — custom mark for the PatternProof Agent.
 * Translucent prism silhouette with a hidden "PP" inside and small
 * pattern nodes around it. Inherits stroke color from currentColor.
 */
/** Re-export the canonical Agent icon (triangle with PP) as PrismIcon
 *  for backwards compatibility with existing imports. */
export { PpTriangleIcon as PrismIcon };

type AccentKey = "neutral" | "pink" | "yellow" | "purple" | "blue";
const ACCENT: Record<AccentKey, string> = {
  neutral: "#C8C3BA",
  pink:    "#E8A0B4",
  yellow:  "#F0DFA0",
  purple:  "#C4B0D8",
  blue:    "#A8CCE0",
};

type Item = {
  to: string;
  label: string;
  Icon: typeof Home | ((p: { size?: number; strokeWidth?: number; color?: string }) => ReactElement);
  custom?: boolean;
  accent: AccentKey;
  /** Treat this nav item as primary CTA (Log Incident). */
  cta?: boolean;
  /** Always show label, pill-shape (Attorney Portal). */
  pinnedLabel?: boolean;
};

const PRIMARY: Item[] = [
  { to: "/dashboard",          label: "Home",            Icon: Home,                 accent: "neutral" },
  { to: "/journal",            label: "Log Incident",    Icon: NotebookPen,          accent: "pink",   cta: true },
  { to: "/timeline",           label: "Timeline",        Icon: TimelineDotsIcon as unknown as typeof Home, custom: true, accent: "yellow" },
  { to: "/patterns",           label: "Patterns",        Icon: DotCirclePatternIcon as unknown as typeof Home, custom: true, accent: "purple" },
  { to: "/agent",              label: "Agent",           Icon: PpTriangleIcon as unknown as typeof Home, custom: true, accent: "blue" },
  { to: "/court-packet",       label: "Court Summary",   Icon: CourtSummaryIcon as unknown as typeof Home, custom: true, accent: "blue", pinnedLabel: true },
];

const OVERFLOW = [
  { to: "/search",              label: "Search",              Icon: SearchIcon },
  { to: "/evidence",            label: "Evidence",            Icon: Files },
  { to: "/message-threads",     label: "Message threads",     Icon: MessageSquare },
  { to: "/voice-notes",         label: "Voice notes",         Icon: Mic },
  { to: "/resources",           label: "Resources",           Icon: BookOpen },
  { to: "/share-with-attorney", label: "Attorney Portal",     Icon: Scale },
  { to: "/attorney-portal",     label: "Shared with attorney", Icon: Scale },
  { to: "/settings",            label: "Settings",            Icon: SettingsIcon },
];

function useScrollDir() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        const y = window.scrollY;
        setHidden(y > last && y > 80);
        last = y;
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}

export function FloatingNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const dim = useScrollDir();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("pp:nav-hidden") === "1";
  });
  useEffect(() => {
    try { window.localStorage.setItem("pp:nav-hidden", hidden ? "1" : "0"); } catch { /* ignore */ }
  }, [hidden]);

  useEffect(() => { setExpanded(null); setMoreOpen(false); }, [pathname]);

  // Close expanded label on outside tap
  useEffect(() => {
    if (!expanded) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.("[data-nav-island]")) setExpanded(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("touchstart", close);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("touchstart", close); };
  }, [expanded]);

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  const signOut = async () => { await supabase.auth.signOut(); };

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="no-print"
        aria-label="Show navigation"
        title="Show navigation"
        style={{
          position: "fixed", left: 12, bottom: 12, zIndex: 100,
          width: 40, height: 40, borderRadius: 999,
          background: "rgba(26,23,20,0.85)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#FAF7F2",
          display: "grid", placeItems: "center",
          backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
          boxShadow: "0 8px 24px rgba(26,23,20,0.30)",
        }}
      >
        <NavIcon icon={Eye} size={18} color="#FAF7F2" />
      </button>
    );
  }

  return (
    <>
      {/* ===== Mobile: bottom island ===== */}
      <div
        className="no-print md:hidden"
        style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: `translateX(-50%) scale(${dim ? 0.94 : 1})`,
          zIndex: 100,
          opacity: dim ? 0.55 : 1,
          transition: "opacity 0.25s ease, transform 0.25s ease",
        }}
      >
        {/* Encryption badge */}
        <div
          style={{
            textAlign: "center",
            fontSize: 9,
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.78)",
            background: "rgba(26,23,20,0.55)",
            padding: "2px 10px",
            borderRadius: 999,
            width: "fit-content",
            margin: "0 auto 8px",
            fontWeight: 700,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          🔒 END-TO-END ENCRYPTED
        </div>
        <div
          data-nav-island
          className="nav-island"
          style={{
            background: "rgba(26,23,20,0.85)",
            WebkitBackdropFilter: "blur(24px)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 100,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 8px 32px rgba(26,23,20,0.25), 0 2px 8px rgba(26,23,20,0.15)",
            transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {PRIMARY.map((it) => {
            const active = isActive(it.to);
            const showLabel = it.pinnedLabel || expanded === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={(e) => {
                  if (it.cta || it.pinnedLabel) return;
                  if (expanded !== it.to) { e.preventDefault(); setExpanded(it.to); }
                }}
                className={it.cta ? "btn-log" : ""}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: showLabel ? "8px 14px" : "10px",
                  borderRadius: 999,
                  background: it.cta
                    ? "rgba(232,160,180,0.20)"
                    : it.pinnedLabel
                      ? "rgba(168,204,224,0.18)"
                      : active ? "rgba(255,255,255,0.08)" : "transparent",
                  color: ACCENT[it.accent],
                  transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                  transform: it.cta ? "scale(1.05)" : "scale(1)",
                }}
                aria-label={it.label}
              >
                {it.custom ? (
                  // Custom SVG (e.g. PrismIcon) — already matches the shared treatment.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (() => { const C = it.Icon as any; return <C size={it.cta ? 22 : 18} strokeWidth={1.75} color={ACCENT[it.accent]} />; })()
                ) : (
                  <NavIcon icon={it.Icon as typeof Home} size={it.cta ? 22 : 18} color={ACCENT[it.accent]} />
                )}
                {showLabel && (
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
                    {it.label}
                  </span>
                )}
                {active && !showLabel && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      bottom: -6,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 4, height: 4, borderRadius: 999,
                      background: ACCENT[it.accent],
                    }}
                  />
                )}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            style={{
              padding: 10, borderRadius: 999,
              background: "transparent", color: "#C8C3BA",
            }}
          >
            <NavIcon icon={MoreHorizontal} size={18} color="#C8C3BA" />
          </button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="Hide navigation"
            title="Hide navigation"
            style={{ padding: 10, borderRadius: 999, background: "transparent", color: "#C8C3BA" }}
          >
            <NavIcon icon={EyeOff} size={16} color="#C8C3BA" />
          </button>
        </div>
      </div>

      {/* ===== Desktop: side dock ===== */}
      <DesktopDock
        isActive={isActive}
        dim={dim}
        onMore={() => setMoreOpen(true)}
        onHide={() => setHidden(true)}
      />

      {/* ===== More sheet ===== */}
      {moreOpen && (
        <div
          className="no-print"
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(26,23,20,0.45)" }}
          onClick={() => setMoreOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="glass"
            style={{
              position: "absolute", right: 16, bottom: 92, top: 16,
              width: "min(320px, calc(100vw - 32px))",
              padding: 18, overflowY: "auto",
              borderRadius: 24,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 11, letterSpacing: "0.18em", fontWeight: 700, color: "#3D3832", textTransform: "uppercase" }}>
                More
              </span>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" style={{ color: "#3D3832" }}>
                <NavIcon icon={X} size={18} color="#3D3832" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {OVERFLOW.map((it) => {
                const active = isActive(it.to);
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{
                      background: active ? "rgba(212,112,138,0.10)" : "transparent",
                      color: "#1A1714", fontSize: 15, fontWeight: 600,
                    }}
                  >
                    <NavIcon icon={it.Icon} size={17} />
                    {it.label}
                  </Link>
                );
              })}
              <button
                onClick={signOut}
                className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                style={{ color: "#3D3832", fontSize: 14, fontWeight: 600 }}
              >
                <NavIcon icon={LogOut} size={16} color="#3D3832" /> Sign out
              </button>
              <Link
                to="/privacy"
                className="mt-1 px-3 py-2 text-left"
                style={{ color: "#6B6478", fontSize: 12, fontWeight: 500, textDecoration: "underline" }}
              >
                Privacy Policy
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function DesktopDock({
  isActive, dim, onMore, onHide,
}: { isActive: (to: string) => boolean; dim: boolean; onMore: () => void; onHide: () => void }) {
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem("pp:nav-expanded");
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    try { window.localStorage.setItem("pp:nav-expanded", expanded ? "1" : "0"); } catch { /* ignore */ }
  }, [expanded]);
  const open = expanded;
  const drag = useDraggable("pp:nav-pos", { left: 16, top: typeof window !== "undefined" ? Math.max(16, window.innerHeight / 2 - 240) : 200 });
  return (
    <div
      ref={drag.ref as React.RefObject<HTMLDivElement>}
      className="no-print hidden md:flex"
      style={{
        position: "fixed",
        ...drag.style,
        transform: `scale(${dim ? 0.97 : 1})`,
        zIndex: 100,
        opacity: dim ? 0.7 : 1,
        background: "rgba(26,23,20,0.85)",
        WebkitBackdropFilter: "blur(24px)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 28,
        padding: "16px 10px",
        width: open ? 224 : 64,
        flexDirection: "column",
        alignItems: "stretch",
        gap: 6,
        overflow: "hidden",
        transition: "width 0.25s ease, opacity 0.25s ease",
        boxShadow: "0 12px 36px rgba(26,23,20,0.30)",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center",
          justifyContent: open ? "space-between" : "center",
          gap: 4, padding: "2px 6px 6px", marginBottom: 2,
          color: "rgba(255,255,255,0.82)",
        }}
      >
        <button
          type="button"
          {...drag.dragHandlers}
          aria-label="Drag to move menu"
          title="Drag to move"
          style={{
            cursor: "grab", padding: 4, borderRadius: 8,
            background: "transparent", color: "rgba(255,255,255,0.6)",
            touchAction: "none",
          }}
        >
          <NavIcon icon={GripVertical} size={16} color="rgba(255,255,255,0.6)" />
        </button>
        {open && (
          <button
            type="button"
            onClick={onHide}
            aria-label="Hide navigation"
            title="Hide navigation"
            style={{ padding: 4, borderRadius: 8, background: "transparent", color: "rgba(255,255,255,0.7)" }}
          >
            <NavIcon icon={EyeOff} size={16} color="rgba(255,255,255,0.7)" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={open ? "Collapse menu" : "Expand menu"}
          title={open ? "Collapse menu" : "Expand menu"}
          style={{ padding: 4, borderRadius: 8, background: "transparent", color: "rgba(255,255,255,0.82)" }}
        >
          <NavIcon icon={open ? PanelLeftClose : PanelLeftOpen} size={open ? 18 : 20} color="rgba(255,255,255,0.82)" />
        </button>
      </div>
      {PRIMARY.map((it) => {
        const active = isActive(it.to);
        return (
          <Link
            key={it.to}
            to={it.to}
            className={it.cta ? "btn-log" : ""}
            title={it.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 10px",
              borderRadius: 16,
              background: it.cta
                ? "rgba(232,160,180,0.18)"
                : it.pinnedLabel
                  ? "rgba(168,204,224,0.16)"
                  : active ? "rgba(255,255,255,0.08)" : "transparent",
              transition: "background 0.2s ease, transform 0.2s ease",
              transform: it.cta ? "scale(1.02)" : "scale(1)",
              borderLeft: active ? `2px solid ${ACCENT[it.accent]}` : "2px solid transparent",
            }}
          >
            {it.custom ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (() => { const C = it.Icon as any; return <C size={22} strokeWidth={1.75} color={ACCENT[it.accent]} />; })()
            ) : (
              <NavIcon icon={it.Icon as typeof Home} size={22} color={ACCENT[it.accent]} style={{ flexShrink: 0, marginLeft: 4 }} />
            )}
            <span
              style={{
                fontSize: 13, fontWeight: 700,
                whiteSpace: "nowrap",
                opacity: open ? 1 : 0,
                transition: "opacity 0.2s ease",
                color: "#FAF7F2",
                letterSpacing: "0.01em",
              }}
            >
              {it.label}
            </span>
          </Link>
        );
      })}
      <button
        onClick={onMore}
        title="More"
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 10px", borderRadius: 16,
          background: "transparent",
        }}
      >
        <NavIcon icon={MoreHorizontal} size={22} color="#C8C3BA" style={{ marginLeft: 4 }} />
        <span
          style={{
            fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
            opacity: open ? 1 : 0, transition: "opacity 0.2s ease",
            color: "#FAF7F2",
          }}
        >
          More
        </span>
      </button>
      <div
        style={{
          marginTop: 6, paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: 9, letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.72)", fontWeight: 700,
          textAlign: "center", whiteSpace: "nowrap",
          opacity: open ? 1 : 0, transition: "opacity 0.2s ease",
        }}
      >
        🔒 ENCRYPTED
      </div>
    </div>
  );
}

export default FloatingNav;