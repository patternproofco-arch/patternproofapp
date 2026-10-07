import { createFileRoute, Link } from "@tanstack/react-router";
import { FoundingTesterForm } from "@/components/FoundingTesterForm";
import { parseTesterSearch } from "@/lib/founding-testers";

export const Route = createFileRoute("/founding-testers")({
  validateSearch: parseTesterSearch,
  head: () => ({
    meta: [
      { title: "Test free. Help shape PatternProof." },
      { name: "description", content: "Survivors, family-law attorneys and paralegals, DV advocates and organizations: explore a free fictional demo, request founding cohort access, and send product feedback." },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/founding-testers" }],
  }),
  component: FoundingTestersPage,
});

function FoundingTestersPage() {
  const { mode = "join", role } = Route.useSearch();
  return (
    <main className="tester-page">
      <p className="folio-kicker">Founding test cohort</p>
      <h1>Help shape PatternProof.</h1>
      <p>Test free. Tell us what is confusing, missing, or getting in your way.</p>
      <div className="tester-audiences" aria-label="Who can test">
        <section className="tester-card" data-persona="survivor">
          <h2>Survivors</h2>
          <p>Help make organizing records easier to understand.</p>
        </section>
        <section className="tester-card" data-persona="attorney">
          <h2>Family-law attorneys &amp; paralegals</h2>
          <p>Tell us what is missing from an evidence review workflow.</p>
        </section>
        <section className="tester-card" data-persona="org">
          <h2>DV advocates &amp; organizations</h2>
          <p>Help us understand what works for survivor support.</p>
        </section>
      </div>
      <section className="tester-card">
        <h2>Start with the free fictional demo</h2>
        <p>No account or payment is needed. The demo is read-only: uploading and exporting are disabled. You can send feedback without joining the cohort.</p>
        <Link to="/demo" className="btn-primary">Try the free demo</Link>
        <p className="tester-note">For cohort testing beyond the demo, request an invitation below. We will confirm the scope and duration of free testing before you start. Professional access remains subject to review. Submitting this form does not create an account, grant access, or start a paid subscription.</p>
      </section>
      <nav className="tester-tabs" aria-label="Testing options">
        <Link to="/founding-testers" search={{ mode: "join", role }} aria-current={mode === "join" ? "page" : undefined}>Request free testing</Link>
        <Link to="/founding-testers" search={{ mode: "feedback", role }} aria-current={mode === "feedback" ? "page" : undefined}>Give feedback</Link>
      </nav>
      <FoundingTesterForm key={`${mode}:${role ?? ""}`} mode={mode} initialRole={role} />
      <p className="tester-disclaimer">PatternProof organizes information. It does not decide what the information proves.</p>
    </main>
  );
}
