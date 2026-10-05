import { createFileRoute } from "@tanstack/react-router";
import {
  CLERK_QUESTIONS,
  COUNSEL_WORKSHEET,
  EVIDENCE_LOGISTICS_NOTICE,
  FOUNDATION_SCRIPT_TEXT_MESSAGES,
  PRINTER_SPOOLER_WARNING,
} from "@/lib/prep/evidentiary-copy";
import {
  EDUCATIONAL_DISCLAIMER,
  SAFETY_COPY_SHORT,
  SAFETY_COPY_STANDARD,
} from "@/lib/prep/constants";

export const Route = createFileRoute("/_authenticated/prep/guide")({
  component: PrepGuide,
});

function PrepGuide() {
  return (
    <div className="space-y-5 prep-print-guide">
      <div className="no-print flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary px-4 py-2 text-sm"
          onClick={() => window.print()}
        >
          Print study guide
        </button>
        <p className="text-xs max-w-sm" style={{ color: "var(--pp-muted)" }}>
          {PRINTER_SPOOLER_WARNING}
        </p>
      </div>

      <header className="space-y-2">
        <h2 className="text-xl" style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}>
          PatternProof court-prep study guide
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--pp-muted)" }}>
          {EDUCATIONAL_DISCLAIMER}
        </p>
      </header>

      <section className="space-y-2 print-avoid-break">
        <h3 className="text-sm font-semibold">Quick Escape — detailed</h3>
        <p className="text-sm leading-relaxed" style={{ color: "var(--pp-muted)" }}>
          {SAFETY_COPY_STANDARD}
        </p>
        <h3 className="text-sm font-semibold mt-3">Safety notice — short</h3>
        <p className="text-sm leading-relaxed" style={{ color: "var(--pp-muted)" }}>
          {SAFETY_COPY_SHORT}
        </p>
      </section>

      <section className="space-y-2 print-avoid-break">
        <h3 className="text-sm font-semibold">Evidence and copy logistics</h3>
        <p className="text-sm leading-relaxed" style={{ color: "var(--pp-muted)" }}>
          {EVIDENCE_LOGISTICS_NOTICE}
        </p>
        <p className="text-sm font-medium">Ask your court clerk:</p>
        <ol className="list-decimal pl-5 space-y-2 text-sm" style={{ color: "var(--pp-muted)" }}>
          {CLERK_QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 print-avoid-break">
        <h3 className="text-sm font-semibold">{FOUNDATION_SCRIPT_TEXT_MESSAGES.title}</h3>
        <p className="text-xs" style={{ color: "var(--pp-warning, #8A5A2E)" }}>
          Attorney review required before courtroom use. Soft educational sample only. Counsel has
          not signed FLAG-01 through FLAG-10.
        </p>
        {FOUNDATION_SCRIPT_TEXT_MESSAGES.paragraphs.map((p) => (
          <p key={p} className="text-sm leading-relaxed" style={{ color: "var(--pp-ink)" }}>
            {p}
          </p>
        ))}
      </section>

      <section className="space-y-3 print-avoid-break">
        <h3 className="text-sm font-semibold">Counsel review worksheet (FLAG-01 through FLAG-10)</h3>
        <p className="text-xs" style={{ color: "var(--pp-muted)" }}>
          Sign-off table for counsel or legal aid. PatternProof does not claim any flag is approved.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr style={{ color: "var(--pp-muted)" }}>
                <th className="py-2 pr-2">Ref</th>
                <th className="py-2 pr-2">Domain</th>
                <th className="py-2 pr-2">Question</th>
                <th className="py-2">Counsel</th>
              </tr>
            </thead>
            <tbody>
              {COUNSEL_WORKSHEET.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--pp-shadow-dark)" }}>
                  <td className="py-2 pr-2 align-top font-semibold">{row.id}</td>
                  <td className="py-2 pr-2 align-top">
                    {row.domain}
                    <div style={{ color: "var(--pp-muted)" }}>{row.specSection}</div>
                  </td>
                  <td className="py-2 pr-2 align-top" style={{ color: "var(--pp-muted)" }}>
                    {row.question}
                  </td>
                  <td className="py-2 align-top whitespace-nowrap">[ ] Approved [ ] Modify</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2 print-avoid-break">
        <h3 className="text-sm font-semibold">What PatternProof stores for court prep</h3>
        <ul className="list-disc pl-5 text-sm space-y-1" style={{ color: "var(--pp-muted)" }}>
          <li>
            Account: state, hearing types, hearing date, order status, learning mode, age brackets,
            module checkboxes.
          </li>
          <li>This browser tab only: county / court branch and unfinished temp notes.</li>
          <li>
            Never: practice answers, children&apos;s names or birthdates, docket numbers, judge
            names, confidential addresses.
          </li>
        </ul>
      </section>
    </div>
  );
}
