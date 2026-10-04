import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { previewShare } from "@/lib/share-preview.functions";

type Preview = { incidents: number; files: number; heldBackEntries: number; heldBackFiles: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What this link will share, shown before it is made. Counts what is going and what is being
 * held back (private or still deciding) and where to change that. A failed check says so: it never
 * shows a reassuring number it doesn't have.
 */
export function SharePreview({
  includeIncidents,
  includeEvidence,
  caseId,
}: {
  includeIncidents: boolean;
  includeEvidence: boolean;
  caseId: string;
}) {
  const preview = useServerFn(previewShare);
  const [state, setState] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "error" } | { kind: "ok"; p: Preview }>({
    kind: "idle",
  });

  useEffect(() => {
    if (!includeIncidents && !includeEvidence && !caseId) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    const t = setTimeout(() => {
      preview({
        data: { include_all_incidents: includeIncidents, include_all_evidence: includeEvidence, case_id: caseId || null },
      })
        .then((p) => !cancelled && setState({ kind: "ok", p }))
        .catch(() => !cancelled && setState({ kind: "error" }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [includeIncidents, includeEvidence, caseId, preview]);

  if (state.kind === "idle") {
    return (
      <p className="text-[13px]" role="status" style={{ color: "var(--muted-foreground)" }}>
        Nothing is selected yet, so nothing would be shared. Choose what to share above.
      </p>
    );
  }
  if (state.kind === "loading") {
    return (
      <p className="text-[13px]" role="status" style={{ color: "var(--muted-foreground)" }}>
        Checking what this would share…
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <p className="text-[13px]" role="alert">
        We couldn't check what this would share. You can still create the link, but we can't show you the
        numbers right now.
      </p>
    );
  }
  const { p } = state;
  const held = p.heldBackEntries + p.heldBackFiles;
  return (
    <div className="rounded-2xl p-3 text-[13px]" role="status" style={{ background: "var(--input)" }}>
      <div className="font-semibold">
        This link will share {plural(p.incidents, "entry", "entries")} and {plural(p.files, "file", "files")}.
      </div>
      {held > 0 && (
        <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>
          {plural(p.heldBackEntries, "entry", "entries")} and {plural(p.heldBackFiles, "file", "files")} are left
          out because they're marked private or you haven't decided yet.{" "}
          <Link to="/journal" className="underline">
            Review your entries
          </Link>
        </p>
      )}
      <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>
        Only what's counted here is shared. Anything you add later stays private until you add it.
      </p>
    </div>
  );
}
