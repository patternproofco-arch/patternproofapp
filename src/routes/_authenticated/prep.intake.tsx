import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { US_STATES } from "@/lib/state-resources";
import {
  CHILDREN_BRACKETS,
  HEARING_TYPES,
  LEARNING_MODES,
  ORDER_STATUSES,
} from "@/lib/prep/constants";
import {
  getSessionCounty,
  getSessionCourtBranch,
  getSessionIntakeDraft,
  setSessionCounty,
  setSessionCourtBranch,
  setSessionIntakeDraft,
} from "@/lib/prep/session-county";
import { getStudyProfile, upsertStudyProfile } from "@/lib/prep/study-profile.functions";

export const Route = createFileRoute("/_authenticated/prep/intake")({
  component: CourtPrepIntake,
});

function CourtPrepIntake() {
  const load = useServerFn(getStudyProfile);
  const save = useServerFn(upsertStudyProfile);
  const [state, setState] = useState("");
  const [hearingTypes, setHearingTypes] = useState<string[]>([]);
  const [hearingDate, setHearingDate] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [learningMode, setLearningMode] = useState("both");
  const [brackets, setBrackets] = useState<string[]>([]);
  const [county, setCounty] = useState("");
  const [courtBranch, setCourtBranch] = useState("");
  const [tempNotes, setTempNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCounty(getSessionCounty());
    setCourtBranch(getSessionCourtBranch());
    setTempNotes(getSessionIntakeDraft());
    let cancelled = false;
    load()
      .then((r) => {
        if (cancelled || !r.profile) return;
        setState(r.profile.state ?? "");
        setHearingTypes(r.profile.hearing_types ?? []);
        setHearingDate(r.profile.hearing_date ?? "");
        setOrderStatus(r.profile.order_status ?? "");
        setLearningMode(r.profile.learning_mode ?? "both");
        setBrackets(r.profile.children_brackets ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const toggle = (list: string[], id: string, set: (v: string[]) => void) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Session-only fields never go to the server.
      setSessionCounty(county);
      setSessionCourtBranch(courtBranch);
      setSessionIntakeDraft(tempNotes);

      await save({
        data: {
          state: state || null,
          hearing_types: hearingTypes as Array<
            "protective_order" | "custody" | "divorce" | "support" | "other_family"
          >,
          hearing_date: hearingDate || null,
          order_status: (orderStatus || null) as
            | "none"
            | "temporary_order"
            | "decree_in_place"
            | null,
          learning_mode: learningMode as "coach" | "guide" | "both",
          children_brackets: brackets as Array<"under_5" | "5_to_11" | "12_plus">,
        },
      });
      toast("Intake saved. County stayed in this tab only.");
    } catch {
      toast("Could not save intake. Check that the study_profiles migration is applied on muy.");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <p className="text-sm" style={{ color: "var(--pp-muted)" }}>
        Loading intake…
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      <p className="text-sm" style={{ color: "var(--pp-muted)" }}>
        We never collect children&apos;s full names or birthdates, case or docket numbers, judge or
        department names, or confidential addresses. County is kept in session memory for this tab
        and clears on Quick Exit or when the tab closes.
      </p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">State</legend>
        <label htmlFor="cp-state" className="sr-only">
          State
        </label>
        <select
          id="cp-state"
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--pp-shadow-dark)", background: "var(--pp-ground)" }}
        >
          <option value="">Select state</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">County / local court branch (this tab only)</legend>
        <label htmlFor="cp-county" className="block text-xs" style={{ color: "var(--pp-muted)" }}>
          County
        </label>
        <input
          id="cp-county"
          value={county}
          onChange={(e) => setCounty(e.target.value.slice(0, 80))}
          className="w-full rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--pp-shadow-dark)", background: "var(--pp-ground)" }}
          autoComplete="off"
        />
        <label htmlFor="cp-branch" className="block text-xs" style={{ color: "var(--pp-muted)" }}>
          Court branch (optional)
        </label>
        <input
          id="cp-branch"
          value={courtBranch}
          onChange={(e) => setCourtBranch(e.target.value.slice(0, 120))}
          className="w-full rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--pp-shadow-dark)", background: "var(--pp-ground)" }}
          autoComplete="off"
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Hearing types</legend>
        {HEARING_TYPES.map((h) => (
          <label key={h.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hearingTypes.includes(h.id)}
              onChange={() => toggle(hearingTypes, h.id, setHearingTypes)}
            />
            {h.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Hearing date (calendar day only)</legend>
        <label htmlFor="cp-date" className="sr-only">
          Hearing date
        </label>
        <input
          id="cp-date"
          type="date"
          value={hearingDate}
          onChange={(e) => setHearingDate(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--pp-shadow-dark)", background: "var(--pp-ground)" }}
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Parenting order status</legend>
        {ORDER_STATUSES.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="order_status"
              checked={orderStatus === o.id}
              onChange={() => setOrderStatus(o.id)}
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Children&apos;s age brackets (no names)</legend>
        {CHILDREN_BRACKETS.map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={brackets.includes(b.id)}
              onChange={() => toggle(brackets, b.id, setBrackets)}
            />
            {b.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Learning mode</legend>
        {LEARNING_MODES.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="learning_mode"
              checked={learningMode === m.id}
              onChange={() => setLearningMode(m.id)}
            />
            {m.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Temp notes (this tab only, not saved to account)</legend>
        <label htmlFor="cp-notes" className="sr-only">
          Temporary notes
        </label>
        <textarea
          id="cp-notes"
          value={tempNotes}
          onChange={(e) => setTempNotes(e.target.value.slice(0, 4000))}
          rows={3}
          className="w-full rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--pp-shadow-dark)", background: "var(--pp-ground)" }}
          placeholder="Clears on Quick Exit or when this tab closes."
        />
      </fieldset>

      <button type="submit" className="btn-primary px-5 py-2.5 text-sm" disabled={busy}>
        {busy ? "Saving…" : "Save intake"}
      </button>
    </form>
  );
}
