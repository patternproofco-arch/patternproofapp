import { Link } from "@tanstack/react-router";
import { portalTheme, neuShadow, type PortalVariant } from "./portal-theme";
import { formatIncidentDate, dateConfidence, type IncidentDateFields } from "@/lib/dates";

export interface ThreadItem extends IncidentDateFields {
  id: string;
  description: string;
}

const CONFIDENCE_LABEL = {
  confirmed: "Confirmed",
  approximate: "Approximate",
  unknown: "Unknown",
} as const;

/**
 * The thread: a vertical line connecting recent marks, drawn solid where the
 * date is confirmed and dashed where the survivor could only give an anchor.
 * Confidence lives in the line itself, not only in the label beside it.
 */
export function ThreadPreview({
  variant,
  items,
  to,
}: {
  variant: PortalVariant;
  items: ThreadItem[];
  to?: string;
}) {
  const t = portalTheme(variant);
  const shadow = neuShadow(t.ground);

  if (items.length === 0) {
    return (
      <div
        style={{
          borderRadius: 18,
          background: t.ground,
          boxShadow: shadow.inSm,
          padding: "16px 18px",
          fontSize: 13,
          color: t.muted,
        }}
      >
        Nothing on the thread yet. Your next Mark will start it.
      </div>
    );
  }

  return (
    <div>
      {items.map((item, i) => {
        const conf = dateConfidence(item.date_precision);
        const color = conf === "confirmed" ? t.accent : conf === "approximate" ? t.muted : t.line;
        return (
          <div
            key={item.id}
            style={{
              position: "relative",
              paddingLeft: 26,
              paddingBottom: i === items.length - 1 ? 0 : 14,
            }}
          >
            {i > 0 && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 4,
                  top: -14,
                  width: 2,
                  height: 14,
                  background: conf === "confirmed" ? color : "transparent",
                  backgroundImage:
                    conf === "confirmed"
                      ? "none"
                      : `repeating-linear-gradient(to bottom, ${color} 0, ${color} 3px, transparent 3px, transparent 6px)`,
                }}
              />
            )}
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: 4,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: conf === "confirmed" ? color : t.ground,
                boxShadow: conf === "confirmed" ? "none" : shadow.inSm,
                border: conf === "confirmed" ? "none" : `1.5px solid ${color}`,
              }}
            />
            <div
              style={{
                borderRadius: 16,
                background: t.ground,
                boxShadow: shadow.upSm,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "baseline",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: t.muted,
                  }}
                >
                  {formatIncidentDate(item)}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color,
                    whiteSpace: "nowrap",
                  }}
                >
                  {CONFIDENCE_LABEL[conf]}
                </span>
              </div>
              <p
                style={{
                  fontFamily: t.displayFont,
                  fontSize: 14.5,
                  fontWeight: 500,
                  margin: 0,
                  color: t.ink,
                  lineHeight: 1.35,
                }}
              >
                {item.description.length > 90
                  ? `${item.description.slice(0, 90)}…`
                  : item.description}
              </p>
            </div>
          </div>
        );
      })}
      {to && (
        <Link
          to={to}
          style={{
            display: "inline-block",
            marginTop: 12,
            fontSize: 12.5,
            fontWeight: 600,
            color: t.link,
            textDecoration: "none",
          }}
        >
          See the full thread →
        </Link>
      )}
    </div>
  );
}
