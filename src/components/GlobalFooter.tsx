import { Link } from "@tanstack/react-router";

const FOOTER_GROUPS = [
  {
    heading: "Product",
    links: [
      { to: "/how-it-works", label: "How it works" },
      { to: "/demo", label: "See a sample case" },
      { to: "/pricing", label: "Pricing" },
    ],
  },
  {
    heading: "Who it’s for",
    links: [
      { to: "/", label: "Survivors" },
      { to: "/for-attorneys", label: "Attorneys" },
      { to: "/for-organizations", label: "Organizations" },
    ],
  },
  {
    heading: "Trust",
    links: [
      { to: "/safety", label: "Safety" },
      { to: "/privacy", label: "Privacy" },
      { to: "/evidence-integrity", label: "Evidence integrity" },
      { to: "/ai-transparency", label: "AI transparency" },
      { to: "/professional-access", label: "Professional access" },
    ],
  },
  {
    heading: "Contact",
    links: [
      { to: "/support", label: "Contact" },
      { to: "/terms", label: "Terms of Service" },
    ],
  },
] as const;

export function GlobalFooter() {
  return (
    <footer className="pp-global-footer no-print">
      <nav aria-label="Footer navigation" className="pp-global-footer-groups">
        {FOOTER_GROUPS.map((group) => (
          <div key={group.heading} className="pp-global-footer-group">
            <h2 className="pp-global-footer-heading">{group.heading}</h2>
            <ul className="pp-global-footer-list">
              {group.links.map((item) => (
                <li key={item.to}>
                  <Link to={item.to}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <p>You choose what is shared and with whom.</p>
    </footer>
  );
}
