import { Link } from "@tanstack/react-router";

const FOOTER_LINKS = [
  { to: "/privacy", label: "Privacy" },
  { to: "/safety", label: "Safety" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/support", label: "Contact" },
] as const;

export function GlobalFooter() {
  return (
    <footer className="pp-global-footer no-print">
      <nav aria-label="Footer navigation">
        {FOOTER_LINKS.map((item) => (
          <Link key={item.to} to={item.to}>
            {item.label}
          </Link>
        ))}
      </nav>
      <p>You choose what is shared and with whom.</p>
    </footer>
  );
}