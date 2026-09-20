import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyVerificationReview,
  confirmAttorneyCaseEngagement,
} from "@/lib/professional-verification.functions";

export function AttorneyVerificationStatus() {
  const get = useServerFn(getMyVerificationReview);
  const renew = useServerFn(confirmAttorneyCaseEngagement);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyVerificationReview>> | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(
    () =>
      get()
        .then(setData)
        .catch(() => setMessage("Verification status could not be loaded.")),
    [get],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <section className="card-pp mb-4" aria-label="Professional verification">
      <h2>Professional verification</h2>
      <p>
        {data
          ? data.verified
            ? "Verified"
            : `Review status: ${data.profile?.verification_status?.replaceAll("_", " ") ?? "pending"}. Case access remains closed until review is complete. Payment does not change this status.`
          : "Loading verification status…"}
      </p>
      {data?.jurisdictions.map((j) => (
        <p key={j.jurisdiction}>
          {j.jurisdiction}: {j.verification_status.replaceAll("_", " ")}
        </p>
      ))}
      {data?.renewals.map((link) => (
        <div key={link.id} className="mt-3">
          <p>
            Sharing connection created {new Date(link.created_at).toLocaleDateString()}. Confirm you
            are still representing this client to renew access.
          </p>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage("");
              try {
                await renew({ data: { link_id: link.id } });
                await refresh();
                setMessage("Confirmation saved. Refresh the client list to open the case.");
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Confirmation could not be saved.");
              } finally {
                setBusy(false);
              }
            }}
          >
            I am still on this case
          </button>
        </div>
      ))}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
