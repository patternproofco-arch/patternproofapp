import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "survivor" | "attorney" | "org";
}

export function PageHeader({ eyebrow, title, description, action, variant = "survivor" }: PageHeaderProps) {
  const titleColor = variant === "attorney" ? "#F1F5F9" : "var(--pp-fg)";
  const descColor = variant === "attorney" ? "rgba(226,232,240,0.75)" : "var(--pp-muted-fg)";
  const eyebrowColor = variant === "attorney" ? "rgba(148,163,184,0.9)" : "var(--pp-muted-fg)";
  const titleFont =
    variant === "attorney"
      ? '"Instrument Serif", Georgia, serif'
      : "var(--font-sans)";
  return (
    <header className="pp-page-header">
      <div className="pp-page-header__text">
        {eyebrow && (
          <div className="pp-page-header__eyebrow" style={{ color: eyebrowColor }}>
            {eyebrow}
          </div>
        )}
        <h1
          className="pp-page-header__title"
          style={{ color: titleColor, fontFamily: titleFont, fontWeight: variant === "attorney" ? 400 : 800 }}
        >
          {title}
        </h1>
        {description && (
          <p className="pp-page-header__desc" style={{ color: descColor }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="pp-page-header__action">{action}</div>}
    </header>
  );
}