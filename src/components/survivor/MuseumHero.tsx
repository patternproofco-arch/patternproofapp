import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Illustration, type IllustrationName } from "@/components/survivor/Illustration";

/**
 * Museum layout (Experience v2): one centred object, a centred text column
 * (eyebrow, serif title, 1-2 lines), then one small centred CTA. Empty/hero
 * states only; content screens keep left-aligned lists with no art.
 */
export function MuseumHero({
  art,
  eyebrow,
  title,
  body,
  cta,
  tone = "cream",
  headingLevel = 2,
  testId,
}: {
  art: IllustrationName;
  eyebrow: string;
  title: string;
  body: ReactNode;
  cta?: { label: string; to?: string; onClick?: () => void; testId?: string };
  tone?: "cream" | "ink";
  headingLevel?: 1 | 2;
  testId?: string;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section
      className={`pp-museum ${tone === "ink" ? "pp-museum--ink" : ""}`}
      data-testid={testId}
      aria-labelledby={testId ? `${testId}-title` : undefined}
    >
      <Illustration name={art} />
      <div className="pp-museum-text">
        <div className="pp2-eyebrow">{eyebrow}</div>
        <Heading id={testId ? `${testId}-title` : undefined} className="pp2-title">
          {title}
        </Heading>
        <p className="pp2-body">{body}</p>
      </div>
      {cta &&
        (cta.to ? (
          <Link to={cta.to} className="pp-museum-cta" data-testid={cta.testId}>
            {cta.label}
          </Link>
        ) : (
          <button type="button" className="pp-museum-cta" onClick={cta.onClick} data-testid={cta.testId}>
            {cta.label}
          </button>
        ))}
    </section>
  );
}
