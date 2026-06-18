import attorneyLogo from "@/assets/patternproof-logo-attorney.png.asset.json";
import survivorLogo from "@/assets/patternproof-logo-survivor.png.asset.json";
import orgLogo from "@/assets/patternproof-logo-org.png.asset.json";

export type LogoVariant = "attorney" | "survivor" | "org";

interface LogoProps {
  variant: LogoVariant;
  size?: number;
  className?: string;
  onDark?: boolean;
}

const sources: Record<LogoVariant, { url: string }> = {
  attorney: attorneyLogo,
  survivor: survivorLogo,
  org: orgLogo,
};

const filters: Record<LogoVariant, string> = {
  survivor: "drop-shadow(0 0 12px rgba(180,160,255,0.35))",
  attorney: "drop-shadow(0 1px 2px rgba(15,27,61,0.25))",
  org: "drop-shadow(0 1px 1px rgba(0,0,0,0.08))",
};

export function Logo({ variant, size = 40, className, onDark = false }: LogoProps) {
  const src = sources[variant].url;
  const filter = onDark && variant === "attorney" ? "none" : filters[variant];
  return (
    <img
      src={src}
      alt="PatternProof logo"
      height={size}
      style={{ height: size, width: "auto", filter, display: "block" }}
      className={className}
      draggable={false}
    />
  );
}

export default Logo;