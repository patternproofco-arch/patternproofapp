import { useState } from "react";
import { Printer } from "lucide-react";
import { DemoCard, demoButtonStyle } from "@/components/demo/DemoPortalShell";
import { DemoPrepNav, type DemoPrepSection } from "@/components/demo/DemoPrepNav";
import { DemoPrepPractice } from "@/components/demo/DemoPrepPractice";
import { EDUCATIONAL_DISCLAIMER } from "@/lib/prep/constants";
import {
  CLERK_QUESTIONS,
  EVIDENCE_LOGISTICS_NOTICE,
  PRINTER_SPOOLER_WARNING,
} from "@/lib/prep/evidentiary-copy";
import { STUDY_MODULES } from "@/lib/prep/modules-content";
import { DEMO_PREP_PROFILE } from "@/lib/demo/fixtures-prep";

/** Fictional court-prep portal: static modules + guide, practice held in memory only. */
export function DemoPrepPortal() {
  const [section, setSection] = useState<DemoPrepSection>("overview");
  return (
    <div>
      <DemoPrepNav current={section} onSelect={setSection} />
      <DemoSafetyNote />
      <div style={{ marginTop: 16 }}>
        {section === "overview" && <Overview onSelect={setSection} />}
        {section === "practice" && <DemoPrepPractice />}
        {section === "modules" && <Modules />}
        {section === "guide" && <Guide />}
      </div>
    </div>
  );
}

function DemoSafetyNote() {
  return (
    <aside
      role="note"
      style={{
        background: "var(--pp-card)",
        boxShadow: "var(--pp-shadow-sm)",
        borderRadius: 18,
        padding: 16,
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      <p style={{ margin: 0, fontWeight: 600 }}>Educational preparation only</p>
      <p style={{ margin: "6px 0 0", color: "var(--pp-muted)" }}>{EDUCATIONAL_DISCLAIMER}</p>
      <p style={{ margin: "6px 0 0", color: "var(--pp-muted)" }}>
        To leave fast, use Exit safely at the top of the page or press Esc twice. It cannot erase
        your browser history. A private window or a device only you use is safer.
      </p>
    </aside>
  );
}

function Overview({ onSelect }: { onSelect: (s: DemoPrepSection) => void }) {
  return (
    <DemoCard title="Sample prep plan (fictional)">
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: "grid", gap: 4 }}>
        <li>Hearing type: {DEMO_PREP_PROFILE.hearingTypeLabel}</li>
        <li>Hearing date: {DEMO_PREP_PROFILE.hearingDateLabel}</li>
        <li>Court: {DEMO_PREP_PROFILE.courtLabel}</li>
      </ul>
      <p style={{ margin: "12px 0", fontSize: 13, color: "var(--pp-muted)" }}>
        In the real portal, a short intake picks which modules show first. Here the plan is a fixed
        sample and nothing you choose is saved.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={demoButtonStyle} onClick={() => onSelect("modules")}>
          Browse {STUDY_MODULES.length} modules →
        </button>
        <button type="button" style={demoButtonStyle} onClick={() => onSelect("practice")}>
          Try practice →
        </button>
        <button type="button" style={demoButtonStyle} onClick={() => onSelect("guide")}>
          Printable guide →
        </button>
      </div>
    </DemoCard>
  );
}

function Modules() {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {STUDY_MODULES.map((m) => {
        const open = openId === m.id;
        return (
          <DemoCard key={m.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : m.id)}
              aria-expanded={open}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                color: "var(--pp-ink)",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700 }}>{m.title}</div>
              <div style={{ fontSize: 13, color: "var(--pp-muted)" }}>
                {m.summary} · about {m.minutes} min
              </div>
            </button>
            {open ? (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {m.sections.map((s) => (
                  <div key={s.heading}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{s.heading}</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.6 }}>{s.body}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </DemoCard>
        );
      })}
    </div>
  );
}

function Guide() {
  return (
    <DemoCard title="Printable guide (static, no personal details)">
      <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.6 }}>
        {EVIDENCE_LOGISTICS_NOTICE}
      </p>
      <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700 }}>
        Questions to ask the clerk
      </h3>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, display: "grid", gap: 4 }}>
        {CLERK_QUESTIONS.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
      <p
        className="no-print"
        style={{ margin: "12px 0 0", fontSize: 12, color: "var(--pp-muted)" }}
      >
        {PRINTER_SPOOLER_WARNING}
      </p>
      <button
        type="button"
        className="no-print"
        style={{ ...demoButtonStyle, marginTop: 12 }}
        onClick={() => window.print()}
      >
        <Printer size={14} /> Print this guide
      </button>
    </DemoCard>
  );
}
