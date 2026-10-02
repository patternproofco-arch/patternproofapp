import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import {
  listPrivateSinceSharing,
  shareNewItemsWithGrant,
} from "@/lib/grant-updates.functions";

interface PrivateSinceSharingProps {
  /** Only show rows for this kind of access. */
  kind: "attorney" | "advocate";
}

type Row = {
  kind: "attorney" | "advocate";
  link_id: string;
  new_incidents: number;
  new_evidence: number;
};

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
        <Lock size={14} /> Kept private — not shared with counsel
      </div>
      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--muted-foreground)", marginTop: 6 }}>
        Anything you've added since you set up this access stays in your own space. It is not
        visible to {label} unless you add it here.
      </p>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {rows.map((r) => (
          <div
            key={r.link_id}
            style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
          >
            <span style={{ fontSize: 12.5 }}>
              {r.new_incidents} {r.new_incidents === 1 ? "entry" : "entries"} and {r.new_evidence}{" "}
              {r.new_evidence === 1 ? "file" : "files"} are private to you.
            </span>
            <button
              className="btn-ghost text-[12px]"
              disabled={busy === r.link_id}
              onClick={async () => {
                setBusy(r.link_id);
                try {
                  await addFn({
                    data: {
                      kind: r.kind,
                      link_id: r.link_id,
                      include_incidents: true,
                      include_evidence: true,
                    },
                  });
                  toast("Added. Those items are now shared.");
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
        ))}
      </div>
    </div>
  );
}
