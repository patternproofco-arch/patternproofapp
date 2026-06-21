import type { LucideProps } from "lucide-react";
import type { ComponentType, CSSProperties } from "react";

/**
 * Shared icon wrapper used by all navigation/dashboard surfaces.
 * Guarantees one consistent stroke width, rounded line caps, rounded joins,
 * and outline-style line treatment across the app, regardless of which
 * lucide-react icon (or custom SVG component) is passed in.
 */
export type NavIconProps = {
  icon: ComponentType<LucideProps>;
  size?: number;
  /** Override stroke width if absolutely needed (default 1.75). */
  strokeWidth?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
};

export function NavIcon({
  icon: Icon,
  size = 20,
  strokeWidth = 1.75,
  color,
  className,
  style,
  ariaLabel,
}: NavIconProps) {
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      absoluteStrokeWidth
      color={color}
      className={className}
      style={style}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
    />
  );
}

export default NavIcon;