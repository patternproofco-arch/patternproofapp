import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { previewShare, type SharePreviewResult } from "@/lib/share-preview.functions";
import {
  selectionFingerprint,
  type ShareMergeMode,
} from "@/lib/sharing/merge-share-scope";

type PreviewOk = Extract<SharePreviewResult, { verified: true }>;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const KIND_LABEL: Record<string, string> = {
  screenshot: "Screenshot",
  transcript: "Transcript / recording text",
  recording: "Recording",
  original: "Original file",
  file: "File",
};

export type SharePreviewStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ok"; preview: PreviewOk };

/**
 * What this link will share, shown before it is made. Counts what is going and what is being
 * held back and where to change that. Lists attachments referenced by shared entries that are
 * not in the file set so she can include them deliberately. A failed check blocks create.
 */
export function SharePreview({
  includeIncidents,
  includeEvidence,
  caseId,
  scopeIncidents,
  scopeEvidence,
  existingLinkId,
  mergeMode,
  linkKind = "attorney",
  deliberateEvidenceIds = [],
  onDeliberateEvidenceChange,
  onStatusChange,
}: {
  includeIncidents: boolean;
  includeEvidence: boolean;
  caseId: string;
  /** Exact picks — when set, include-all for that category is ignored. */
  scopeIncidents?: string[];
  scopeEvidence?: string[];
  existingLinkId?: string | null;
  mergeMode?: ShareMergeMode | null;
  linkKind?: "attorney" | "advocate";
  /** Extra evidence ids she chose from the missing-attachments list. */
  deliberateEvidenceIds?: string[];
  onDeliberateEvidenceChange?: (ids: string[]) => void;
  onStatusChange?: (status: SharePreviewStatus) => void;
}) {
  const preview = useServerFn(previewShare);
  const [state, setState] = useState<SharePreviewStatus>({ kind: "idle" });

  const hasExplicitInc = Array.isArray(scopeIncidents);
  const hasExplicitEv = Array.isArray(scopeEvidence);

  const fingerprint = selectionFingerprint({
    include_all_incidents: hasExplicitInc ? false : includeIncidents,
    include_all_evidence: hasExplicitEv ? false : includeEvidence,
    scope_incidents: scopeIncidents,
    scope_evidence: scopeEvidence,
    deliberate_evidence: deliberateEvidenceIds,
    case_id: caseId || null,
    merge_mode: mergeMode ?? null,
    existing_link_id: existingLinkId ?? null,
  });

  const nothingSelected =
    !includeIncidents &&
    !includeEvidence &&
    !caseId &&
    !(hasExplicitInc && (scopeIncidents?.length ?? 0) > 0) &&
    !(hasExplicitEv && (scopeEvidence?.length ?? 0) > 0) &&
    deliberateEvidenceIds.length === 0;

  useEffect(() => {
    if (nothingSelected) {
      const idle = { kind: "idle" as const };
      setState(idle);
      onStatusChange?.(idle);
      return;
    }
    if (existingLinkId && !mergeMode) {
      const idle = { kind: "idle" as const };
      setState(idle);
      onStatusChange?.(idle);
      return;
    }
    let cancelled = false;
    const loading = { kind: "loading" as const };
    setState(loading);
    onStatusChange?.(loading);
    const t = setTimeout(() => {
      preview({
        data: {
          include_all_incidents: hasExplicitInc ? false : includeIncidents,
          include_all_evidence: hasExplicitEv ? false : includeEvidence,
          scope_incidents: hasExplicitInc ? scopeIncidents : undefined,
          scope_evidence: hasExplicitEv ? scopeEvidence : undefined,
          deliberate_evidence: deliberateEvidenceIds,
          case_id: caseId || null,
          existing_link_id: existingLinkId || null,
          merge_mode: mergeMode ?? null,
          link_kind: linkKind,
        },
      })
        .then((p) => {
          if (cancelled) return;
          const ok = { kind: "ok" as const, preview: p };
          setState(ok);
          onStatusChange?.(ok);
        })
        .catch(() => {
          if (cancelled) return;
          const err = { kind: "error" as const };
          setState(err);
          onStatusChange?.(err);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, nothingSelected, linkKind, preview]);

  const toggleMissing = (id: string, checked: boolean) => {
    if (!onDeliberateEvidenceChange) return;
    const next = checked
      ? Array.from(new Set([...deliberateEvidenceIds, id]))
      : deliberateEvidenceIds.filter((x) => x !== id);
    onDeliberateEvidenceChange(next);
  };

  if (state.kind === "idle") {
    if (existingLinkId && !mergeMode) {
      return (
        <p className="text-[13px]" role="status" style={{ color: "var(--muted-foreground)" }}>
          Choose whether to <strong>Add items</strong> to what they already have, or{" "}
          <strong>Replace what&apos;s shared</strong>, then review the preview before creating a
          link.
        </p>
      );
    }
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
      <p className="text-[13px]" role="alert" data-testid="share-preview-error">
        We couldn&apos;t check what this would share. The link cannot be created until this check
        succeeds. Try again in a moment.
      </p>
    );
  }
  const { preview: p } = state;
  const held = p.heldBackEntries + p.heldBackFiles;
  const missing = p.missing_attachments ?? [];
  return (
    <div
      className="rounded-2xl p-3 text-[13px]"
      role="status"
      data-testid="share-preview-ok"
      style={{ background: "var(--input)" }}
    >
      <div className="font-semibold">
        This link will share {plural(p.incidents, "entry", "entries")} and{" "}
        {plural(p.files, "file", "files")}.
      </div>
      {p.merge && (
        <div className="mt-2 rounded-xl p-2 text-[12px]" style={{ background: "var(--background)" }}>
          <div className="font-semibold">
            {p.merge.mode === "add" ? "Add items" : "Replace what’s shared"}
          </div>
          <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>
            They currently have {plural(p.merge.previously.incidents, "entry", "entries")} and{" "}
            {plural(p.merge.previously.files, "file", "files")}.
            {p.merge.mode === "add"
              ? ` Adding ${plural(p.merge.added.incidents, "entry", "entries")} and ${plural(p.merge.added.files, "file", "files")}.`
              : ` After replace: ${plural(p.merge.resulting.incidents, "entry", "entries")} and ${plural(p.merge.resulting.files, "file", "files")}${
                  p.merge.removed.incidents + p.merge.removed.files > 0
                    ? ` (${plural(p.merge.removed.incidents + p.merge.removed.files, "item loses", "items lose")} access)`
                    : ""
                }.`}
          </p>
          <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>
            Ending access later cannot retrieve copies already downloaded or transferred.
          </p>
        </div>
      )}
      {missing.length > 0 && (
        <div
          className="mt-2 rounded-xl p-2 text-[12px]"
          style={{ background: "var(--background)" }}
          data-testid="missing-attachments"
        >
          <div className="font-semibold">
            {plural(missing.length, "attached file is", "attached files are")} referenced by your
            selected entries but not included yet
          </div>
          <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>
            If you leave {missing.length === 1 ? "it" : "them"} out, the recipient will see the
            entry but won&apos;t be able to open the source file. Include only what you choose —
            nothing is added automatically.
          </p>
          <ul className="mt-2 space-y-1.5">
            {missing.map((m) => {
              const checked = deliberateEvidenceIds.includes(m.id);
              return (
                <li key={m.id}>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={!onDeliberateEvidenceChange}
                      onChange={(e) => toggleMissing(m.id, e.target.checked)}
                      data-testid={`missing-attachment-${m.id}`}
                    />
                    <span>
                      <span className="font-medium">{m.title}</span>
                      <span style={{ color: "var(--muted-foreground)" }}>
                        {" "}
                        · {KIND_LABEL[m.kind] ?? "File"}
                        {m.kept_private ? " · currently private (include authorizes this invite only)" : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {held > 0 && (
        <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>
          {plural(p.heldBackEntries, "entry", "entries")} and {plural(p.heldBackFiles, "file", "files")}{" "}
          are left out because they&apos;re marked private or you haven&apos;t decided yet
          {hasExplicitInc || hasExplicitEv || deliberateEvidenceIds.length > 0
            ? " — unless you explicitly selected them for this invitation"
            : ""}
          .{" "}
          <Link to="/journal" className="underline">
            Review your entries
          </Link>
        </p>
      )}
      <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>
        Only what&apos;s counted here is shared. Anything you add later stays private until you add
        it. &ldquo;OK to share later&rdquo; alone grants nobody access. Ending access cannot
        retrieve copies already downloaded or transferred.
      </p>
    </div>
  );
}
