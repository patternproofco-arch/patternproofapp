import attorneyLogo from "@/assets/logo-attorney-navy.png.asset.json";
import survivorLogo from "@/assets/logo-survivor-iridescent.png.asset.json";
import orgLogo from "@/assets/logo-org-sage.png.asset.json";

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
  survivor:
    "drop-shadow(0 0 14px rgba(196,138,232,0.55)) drop-shadow(0 0 28px rgba(120,200,232,0.40))",
  attorney:
    "drop-shadow(0 0 14px rgba(120,160,255,0.55)) drop-shadow(0 0 32px rgba(60,110,230,0.40))",
  org:
    "drop-shadow(0 0 14px rgba(140,180,120,0.55)) drop-shadow(0 0 30px rgba(110,150,90,0.38))",
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