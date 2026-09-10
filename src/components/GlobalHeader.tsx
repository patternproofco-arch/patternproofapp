import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { SettingsProvider, useSettings } from "@/lib/settings-context";
import { quickExit } from "@/lib/quick-exit";

const NAV_ITEMS = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/for-attorneys", label: "Attorneys" },
  { to: "/for-organizations", label: "Organizations" },
  { to: "/pricing", label: "Pricing" },
] as const;

function HeaderExit() {
  const { settings } = useSettings();
  const lastEscape = useRef(0);

  const leave = () => quickExit(settings.exitUrl);

  useEffect(() => {
    (window as unknown as { __ppQuickExitHydrated?: boolean }).__ppQuickExitHydrated = true;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const now = Date.now();
      if (now - lastEscape.current < 500) leave();
      lastEscape.current = now;
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settings.exitUrl]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="pp-global-exit"
      onClick={leave}
      data-quick-exit="true"
      aria-label="Exit safely"
      title="Exit safely — signs you out and leaves"
    >
      Exit safely
      <ArrowUpRight aria-hidden="true" />
    </Button>
  );
}

export function GlobalHeader() {
  return (
    <header className="pp-global-header no-print">
      <Link to="/" className="pp-global-brand" aria-label="PatternProof home">
        <BrandMark size={20} variant="ink" onDark />
        <span>PATTERNPROOF</span>
      </Link>

      <nav className="pp-global-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <Link key={item.to} to={item.to}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="pp-global-actions">
        <SettingsProvider applyDisguiseTitle={false}>
          <HeaderExit />
        </SettingsProvider>
        <Link to="/signin" className="pp-global-signin">
          Sign in
        </Link>
      </div>
    </header>
  );
}