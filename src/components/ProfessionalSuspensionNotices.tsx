import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMySuspensionNotices,
  markSuspensionNoticeSeen,
} from "@/lib/professional-verification.functions";

export function ProfessionalSuspensionNotices() {
  const list = useServerFn(listMySuspensionNotices);
  const markSeen = useServerFn(markSuspensionNoticeSeen);
  const [notices, setNotices] = useState<
    Awaited<ReturnType<typeof listMySuspensionNotices>>["notices"]
  >([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      list()
        .then((r) => {
          if (active) {
            setNotices(r.notices);
            setError(false);
          }
        })
        .catch(() => {
          if (active) setError(true);
        });
    void refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [list]);
  if (error)
    return (
      <p role="status" className="card-pp">
        Sharing notices could not be loaded. Refresh to try again.
      </p>
    );
  return (
    <>
      {notices
        .filter((n) => !n.seen_at)
        .map((n) => (
          <section className="card-pp" role="status" key={n.id}>
            <p>
              Access was suspended for{" "}
              {n.subject_kind === "attorney" ? "an attorney" : "an organization"} you shared with on{" "}
              {new Date(n.created_at).toLocaleDateString()}. Review your sharing settings for
              current access. Files already downloaded cannot be recalled.
            </p>
            <button
              className="btn-ghost"
              onClick={async () => {
                try {
                  await markSeen({ data: { id: n.id } });
                  setNotices((rows) => rows.filter((row) => row.id !== n.id));
                } catch {
                  setError(true);
                }
              }}
            >
              Dismiss notice
            </button>
          </section>
        ))}
    </>
  );
}
