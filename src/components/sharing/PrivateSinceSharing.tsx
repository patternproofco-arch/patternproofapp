import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { listPrivateSinceSharing, shareNewItemsWithGrant } from "@/lib/grant-updates.functions";

interface PrivateSinceSharingProps {
  /** Only show rows for this kind of access. */
  kind: "attorney" | "advocate";
}

type Row = {
  kind: "attorney" | "advocate";
  link_id: string;
  /** OK to share, not in this share yet. */
  new_incidents: number;
  new_evidence: number;
  /** Kept private or still deciding. "Add these too" never adds these. */
  held_back_incidents?: number;
  held_back_evidence?: number;
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Sharing is frozen to what existed when the survivor chose to share. This
 * panel makes that visible and gives them an explicit way to add newer
 * entries — never automatic.
 */
export function PrivateSinceSharing({ kind }: PrivateSinceSharingProps) {
  const listFn = useServerFn(listPrivateSinceSharing);
  const addFn = useServerFn(shareNewItemsWithGrant);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listFn()
      .then((r) => setRows((r.grants ?? []).filter((g) => g.kind === kind) as Row[]))
      .catch(() => setRows([]));
  }, [listFn, kind]);

  useEffect(() => {
    load();
  }, [load]);

  if (!rows.length) return null;

  const label = kind === "attorney" ? "your attorney" : "your advocate";

  return (
    <div className="card-pp mt-6" style={{ padding: 16, borderLeft: "3px solid var(--safe)" }}>
      <div className="flex items-center gap-2" style={{ fontSize: 13.5, fontWeight: 700 }}>
        <Lock size={14} /> Not in this share
      </div>
      <p
        style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--muted-foreground)", marginTop: 6 }}
      >
        Anything you've added since you set up this access stays in your own space. It is not
        visible to {label} unless you choose to share it.
      </p>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {rows.map((r) => {
          const addable = r.new_incidents + r.new_evidence;
          const heldInc = r.held_back_incidents ?? 0;
          const heldEv = r.held_back_evidence ?? 0;
          return (
            <div key={r.link_id} style={{ display: "grid", gap: 6 }}>
              {addable > 0 && (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5 }}>
                    {count(r.new_incidents, "entry", "entries")} and{" "}
                    {count(r.new_evidence, "file", "files")} marked OK to share{" "}
                    {addable === 1 ? "isn't" : "aren't"} in this share yet.
                  </span>
                  <button
                    className="btn-ghost text-[12px]"
                    disabled={busy === r.link_id}
                    onClick={async () => {
                      setBusy(r.link_id);
                      try {
                        const res = await addFn({
                          data: {
                            kind: r.kind,
                            link_id: r.link_id,
                            include_incidents: true,
                            include_evidence: true,
                          },
                        });
                        const added = res.added_incidents + res.added_evidence;
                        toast(
                          added > 0
                            ? `Added ${count(res.added_incidents, "entry", "entries")} and ${count(res.added_evidence, "file", "files")} marked OK to share. Items you kept private were not added.`
                            : "Nothing new to add. Items you kept private were not added.",
                        );
                        load();
                      } catch (e) {
                        toast(
                          e instanceof Error
                            ? e.message
                            : "We couldn't add those right now. Try again in a moment.",
                        );
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === r.link_id ? "Adding…" : "Add these too"}
                  </button>
                </div>
              )}
              {heldInc + heldEv > 0 && (
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  {count(heldInc, "entry", "entries")} and {count(heldEv, "file", "files")} you kept
                  private or are still deciding about stay private. &ldquo;Add these too&rdquo;
                  never includes them.
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
