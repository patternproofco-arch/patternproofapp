import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getModule } from "@/lib/prep/modules-content";
import { PracticeCoachPanel } from "@/components/prep/PracticeCoachPanel";

export const Route = createFileRoute("/_authenticated/prep/modules/$moduleId")({
  component: ModuleDetail,
});

function ModuleDetail() {
  const { moduleId } = Route.useParams();
  const mod = getModule(moduleId);
  const [justDone, setJustDone] = useState(false);

  if (!mod) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm">
          That module was not found.
        </p>
        <Link to="/prep/modules" className="text-sm underline">
          Back to modules
        </Link>
      </div>
    );
  }

  return (
    <article className="space-y-4">
      <Link to="/prep/modules" className="text-xs uppercase tracking-wide no-print" style={{ color: "var(--pp-muted)", fontFamily: "var(--font-mono)" }}>
        ← Modules
      </Link>
      <h2 className="text-xl" style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}>
        {mod.title}
      </h2>
      <p className="text-sm" style={{ color: "var(--pp-muted)" }}>
        {mod.summary}
      </p>
      {mod.sections.map((s) => (
        <section key={s.heading} className="space-y-2">
          <h3 className="text-sm font-semibold">{s.heading}</h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--pp-muted)" }}>
            {s.body}
          </p>
        </section>
      ))}
      {justDone && (
        <p className="text-sm" role="status" style={{ color: "var(--pp-ink)" }}>
          Progress saved as complete. Practice text was not stored.
        </p>
      )}
      <PracticeCoachPanel
        moduleId={mod.id}
        practicePrompt={mod.practicePrompt}
        onCompleted={() => setJustDone(true)}
      />
    </article>
  );
}
