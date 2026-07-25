import { EchoP } from "./EchoP";
import { INK, LAVENDER, PLEX } from "./echo";

interface BrandLockupProps {
  /** Height of the mark itself, in px. Type scales with it. */
  size?: number;
  className?: string;
  /** Hide the tagline line (tight header placements). */
  showTagline?: boolean;
}

/**
 * Tier 1 — Brand Lockup. MARKETING ONLY.
 *
 * Dense echoed-outline P (13 copies) on a lavender card, with the
 * "PATTERN PROOF" wordmark and "THE PROOF IS IN THE PATTERN" tagline.
 *
 * Allowed surfaces: marketing site header/hero, social share images,
 * the attorney one-pager PDF. Never inside the logged-in app, never in
 * the attorney portal, never in exports (use AppMark there).
 */
export function BrandLockup({ size = 92, className, showTagline = true }: BrandLockupProps) {
  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 18,
        background: LAVENDER,
        padding: `${Math.round(size * 0.34)}px ${Math.round(size * 0.42)}px`,
      }}
    >
      <EchoP copies={13} size={size} ink={INK} minOpacity={0.12} />
      <div>
        <div
          style={{
            fontFamily: PLEX,
            fontWeight: 800,
            fontSize: Math.max(13, Math.round(size * 0.2)),
            letterSpacing: "0.18em",
            color: INK,
            lineHeight: 1.1,
          }}
        >
          PATTERN PROOF
        </div>
        {showTagline && (
          <div
            style={{
              marginTop: 8,
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: Math.max(9.5, Math.round(size * 0.115)),
              letterSpacing: "0.14em",
              color: "rgba(23,21,34,0.55)",
            }}
          >
            THE PROOF IS IN THE PATTERN
          </div>
        )}
      </div>
    </div>
  );
}

export default BrandLockup;