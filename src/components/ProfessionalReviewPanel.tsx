import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listProfessionalReviews,
  setOrgVerificationStatus,
  setAttorneyVerificationStatus,
  setAttorneyBarJurisdictionStatus,
} from "@/lib/professional-verification.functions";

const statuses = ["pending", "needs_more_info", "declined", "verified", "suspended"] as const;
type Status = (typeof statuses)[number];
export function ProfessionalReviewPanel() {
  const list = useServerFn(listProfessionalReviews);
  const saveOrg = useServerFn(setOrgVerificationStatus);
  const saveAttorney = useServerFn(setAttorneyVerificationStatus);
  const saveBar = useServerFn(setAttorneyBarJurisdictionStatus);
  const [data, setData] = useState<Awaited<ReturnType<typeof listProfessionalReviews>> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState<Status>("pending");
  const [reason, setReason] = useState("");
  const [humanReviewed, setHumanReviewed] = useState(false);
  const [jurisdiction, setJurisdiction] = useState("");
  const [barNumber, setBarNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(
    () =>
      list()
        .then(setData)
        .catch(() =>
          setError("Professional reviews are unavailable or this account is not an administrator."),
        ),
    [list],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const [kind, id] = selected.split(":");
  const run = async (barOnly: boolean) => {
    if (!humanReviewed || !id) return;
    setBusy(true);
    setError("");
    try {
      if (barOnly)
        await saveBar({
          data: {
            attorney_user_id: id,
            jurisdiction,
            bar_number: barNumber,
            bar_callback_phone: phone,
            status,
          },
        });
      else if (kind === "organization") await saveOrg({ data: { org_id: id, status, reason } });
      else await saveAttorney({ data: { attorney_user_id: id, status, reason } });
      setHumanReviewed(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this review.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card-pp" aria-label="Professional review decisions">
      <h2>Professional verification decisions</h2>
      <p>
        Access-request approval only permits setup. Verify credentials separately before marking an
        account Verified. Suspension revokes access and cannot recall downloaded files.
      </p>
      <label>
        Account
        <select
          className="input-pp"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setStatus("pending");
            setReason("");
            setJurisdiction("");
            setBarNumber("");
            setPhone("");
            setHumanReviewed(false);
          }}
        >
          <option value="">Choose an account</option>
          {data?.orgs.map((o) => (
            <option key={o.id} value={`organization:${o.id}`}>
              {o.name}: {o.verification_status}
            </option>
          ))}
          {data?.attorneys.map((a) => (
            <option key={a.user_id} value={`attorney:${a.user_id}`}>
              {a.full_name} ({a.email}): {a.verification_status}
            </option>
          ))}
        </select>
      </label>
      {kind === "attorney" && (
        <div>
          <p>
            Declared jurisdiction:{" "}
            {data?.attorneys.find((a) => a.user_id === id)?.jurisdiction || "Not supplied"}. Review
            every declared jurisdiction.
          </p>
          {data?.jurisdictions
            .filter((j) => j.attorney_user_id === id)
            .map((j) => (
              <p key={j.jurisdiction}>
                {j.jurisdiction}: {j.verification_status}
              </p>
            ))}
          <label>
            Jurisdiction
            <input
              className="input-pp"
              value={jurisdiction}
              onChange={(e) => {
                setJurisdiction(e.target.value);
                setHumanReviewed(false);
              }}
            />
          </label>
          <label>
            Bar number
            <input
              className="input-pp"
              value={barNumber}
              onChange={(e) => {
                setBarNumber(e.target.value);
                setHumanReviewed(false);
              }}
            />
          </label>
          <label>
            Callback phone from the bar record
            <input
              className="input-pp"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setHumanReviewed(false);
              }}
            />
          </label>
        </div>
      )}
      <label>
        Decision
        <select
          className="input-pp"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as Status);
            setHumanReviewed(false);
          }}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Review note
        <textarea
          className="input-pp"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setHumanReviewed(false);
          }}
        />
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={humanReviewed}
          onChange={(e) => setHumanReviewed(e.target.checked)}
        />
        I reviewed the credentials and intend to record this decision.
      </label>
      {kind === "attorney" && (
        <button
          className="btn-ghost"
          disabled={
            busy ||
            !humanReviewed ||
            !id ||
            jurisdiction.trim().length < 2 ||
            (status === "verified" && !phone.trim())
          }
          onClick={() => void run(true)}
        >
          Save jurisdiction decision
        </button>
      )}
      <button
        className="btn-primary"
        disabled={busy || !humanReviewed || !id}
        onClick={() => void run(false)}
      >
        Save account decision
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
