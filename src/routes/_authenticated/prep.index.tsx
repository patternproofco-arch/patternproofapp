import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getStudyProfile } from "@/lib/prep/study-profile.functions";
import { STUDY_MODULES } from "@/lib/prep/modules-content";
import { SAFETY_COPY_STANDARD } from "@/lib/prep/constants";

export const Route = createFileRoute("/_authenticated/prep/")({
  component: CourtPrepOverview,
});

function CourtPrepOverview() {
  const load = useServerFn(getStudyProfile);
  const [completed, setCompleted] = useState(0);
  const [hasProfile, setHasProfile] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((r) => {
        if (cancelled) return;
        setHasProfile(!!r.profile);
        setCompleted(r.progress.filter((p) => p.status === "completed").length);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed" style={{ color: "var(--pp-muted)" }}>
        Set a short intake (state, hearing type, age brackets only), study procedural modules, and
        practice speaking calmly. Practice answers are not saved. County stays in this browser tab
        only.
      </p>

      {failed && (
        <p role="alert" className="text-sm" style={{ color: "var(--pp-warning, #8A5A2E)" }}>
          Could not load your study profile yet. If this is your first visit, start intake. Tables
          must exist on the database (ask Grace to apply the study_profiles migration on muy).
        </p>
      )}

      <ul className="grid gap-3">
        <li>
          <Link
            to="/prep/intake"
            className="block rounded-2xl p-4"
            style={{ background: "var(--pp-card)", boxShadow: "var(--pp-shadow-sm)" }}
          >
            <span className="font-semibold" style={{ color: "var(--pp-ink)" }}>
              {hasProfile ? "Update intake" : "Start intake"}
            </span>
            <span className="block text-sm mt-1" style={{ color: "var(--pp-muted)" }}>
              State, hearing types, date, age brackets. No names, dockets, or addresses.
            </span>
          </Link>
        </li>
        <li>
          <Link
            to="/prep/modules"
            className="block rounded-2xl p-4"
            style={{ background: "var(--pp-card)", boxShadow: "var(--pp-shadow-sm)" }}
          >
            <span className="font-semibold" style={{ color: "var(--pp-ink)" }}>
              Study modules
            </span>
            <span className="block text-sm mt-1" style={{ color: "var(--pp-muted)" }}>
              {completed} of {STUDY_MODULES.length} marked complete
            </span>
          </Link>
        </li>
        <li>
          <Link
            to="/prep/guide"
            className="block rounded-2xl p-4"
            style={{ background: "var(--pp-card)", boxShadow: "var(--pp-shadow-sm)" }}
          >
            <span className="font-semibold" style={{ color: "var(--pp-ink)" }}>
              Printable study guide
            </span>
            <span className="block text-sm mt-1" style={{ color: "var(--pp-muted)" }}>
              Clerk questions and flagged foundation script. Uses browser print.
            </span>
          </Link>
        </li>
      </ul>

      <p className="text-xs leading-relaxed no-print" style={{ color: "var(--pp-muted)" }}>
        {SAFETY_COPY_STANDARD}
      </p>
    </div>
  );
}
