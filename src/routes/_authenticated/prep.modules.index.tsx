import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getStudyProfile } from "@/lib/prep/study-profile.functions";
import { modulesForHearingTypes, STUDY_MODULES } from "@/lib/prep/modules-content";

export const Route = createFileRoute("/_authenticated/prep/modules/")({
  component: ModulesList,
});

function ModulesList() {
  const load = useServerFn(getStudyProfile);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [types, setTypes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((r) => {
        if (cancelled) return;
        setTypes(r.profile?.hearing_types ?? []);
        const map: Record<string, boolean> = {};
        for (const p of r.progress) {
          if (p.status === "completed") map[p.module_id] = true;
        }
        setDone(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const modules = modulesForHearingTypes(types);

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: "var(--pp-muted)" }}>
        Procedural education only. Completing a module stores a checkbox, not your practice words.
      </p>
      <ul className="space-y-3">
        {modules.map((m) => (
          <li key={m.id}>
            <Link
              to="/prep/modules/$moduleId"
              params={{ moduleId: m.id }}
              className="block rounded-2xl p-4"
              style={{ background: "var(--pp-card)", boxShadow: "var(--pp-shadow-sm)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-semibold" style={{ color: "var(--pp-ink)" }}>
                    {m.title}
                  </span>
                  <span className="block text-sm mt-1" style={{ color: "var(--pp-muted)" }}>
                    {m.summary}
                  </span>
                  <span className="block text-xs mt-2" style={{ color: "var(--pp-muted)" }}>
                    About {m.minutes} min
                  </span>
                </div>
                <span className="text-xs shrink-0" style={{ color: "var(--pp-muted)" }}>
                  {done[m.id] ? "Done" : "Open"}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {modules.length < STUDY_MODULES.length && (
        <p className="text-xs" style={{ color: "var(--pp-muted)" }}>
          Showing modules matched to your hearing types. Update intake to change the list.
        </p>
      )}
    </div>
  );
}
