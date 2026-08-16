import { Link, Outlet } from "@tanstack/react-router";
import { RotateCcw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { DemoProvider, useDemo } from "@/lib/demo/demo-store";
import { DEMO_PERSON } from "@/lib/demo/demo-data";
import { DemoSideNav, DemoMobileNav } from "@/components/demo/DemoNav";
import "@/styles/survivor.css";
import "@/styles/demo.css";

function DemoTopBar() {
  const { reset } = useDemo();
  return (
    <header className="pp-topbar no-print">
      <span className="demo-chip" aria-live="polite">DEMO — FICTIONAL DATA</span>
      <div className="demo-topbar__spacer" />
      <span className="demo-topbar__case">{DEMO_PERSON.caseLabel}</span>
      <button
        type="button"
        className="demo-reset"
        onClick={() => {
          reset();
          toast("Demo reset to its starting state.");
        }}
      >
        <RotateCcw size={14} /> Reset demo
      </button>
      <Link to="/" className="demo-exit"><ArrowLeft size={14} /> Exit demo</Link>
      <div className="pp-avatar" aria-hidden>{DEMO_PERSON.initials}</div>
    </header>
  );
}

function DemoBanner() {
  return (
    <div className="demo-banner">
      <strong>DEMO — FICTIONAL DATA.</strong> Every person, date, and record on this screen is invented for a
      product walkthrough. Nothing here is stored in PatternProof, and no real survivor record is involved.
    </div>
  );
}

/** Demo layout: the real survivor visual system, an isolated in-browser dataset. */
export function DemoShell() {
  return (
    <DemoProvider>
      <div className="pp-portal pp-shell demo-root w-full" data-density="survivor" data-persona="survivor">
        <DemoSideNav />
        <div className="pp-main">
          <DemoTopBar />
          <DemoBanner />
          <DemoMobileNav />
          <main className="mx-auto w-full max-w-6xl px-4 md:px-8" style={{ paddingTop: 22, paddingBottom: 72 }}>
            <Outlet />
          </main>
        </div>
        <div className="demo-watermark no-print" aria-hidden>DEMO — FICTIONAL DATA</div>
      </div>
    </DemoProvider>
  );
}

export default DemoShell;
