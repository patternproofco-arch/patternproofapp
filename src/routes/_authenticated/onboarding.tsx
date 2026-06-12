import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSettings } from "@/lib/settings-context";
import { usePinLock } from "@/lib/pin-lock";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function Onboarding() {
  const navigate = useNavigate();
  const { update } = useSettings();
  const { setRealPin } = usePinLock();
  const [step, setStep] = useState<"hello" | "pin" | "promise" | "state">("hello");
  const [pin, setPin] = useState("");
  const [state, setState] = useState("NJ");

  const finishPin = async () => {
    if (pin.length === 4) {
      await setRealPin(pin);
    }
    setStep("promise");
  };

  const finishAll = () => {
    update({ state, onboarded: true });
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 md:py-16">
      {step === "hello" && (
        <div className="card-pp space-y-4">
          <h1 className="font-serif text-[28px]">You don't have to remember everything alone.</h1>
          <div className="space-y-3 text-[14px] leading-relaxed">
            <p>PatternProof holds your story for you. Quietly. In your own words.</p>
            <p>Before anything else, we'll set a 4-digit code that only you know. So if someone picks up your phone, your space stays yours.</p>
            <p>If you are in immediate danger, call <strong>911</strong>. National DV Hotline: <strong>1-800-799-7233</strong>.</p>
          </div>
          <button onClick={() => setStep("pin")} className="btn-primary">Set my code</button>
        </div>
      )}

      {step === "pin" && (
        <div className="card-pp space-y-4">
          <h1 className="font-serif text-[28px]">Your 4-digit code.</h1>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Pick four digits no one else would guess. We never show them or store them anywhere you can read them.
          </p>
          <Field label="4-digit code" value={pin} onChange={setPin} />
          <button onClick={finishPin} className="btn-primary">Continue</button>
          <button onClick={() => setStep("promise")} className="btn-ghost w-full text-[13px]" style={{ color: "var(--muted-foreground)" }}>Skip for now</button>
        </div>
      )}

      {step === "promise" && (
        <div className="card-pp space-y-5" style={{ textAlign: "center", padding: "40px 24px" }}>
          <h1 className="font-serif" style={{ fontSize: 40, lineHeight: 1.15 }}>This app is free.</h1>
          <h2 className="font-serif" style={{ fontSize: 32, color: "var(--accent)" }}>Full stop.</h2>
          <p className="text-[14px]" style={{ color: "var(--muted-foreground)", maxWidth: 420, margin: "0 auto" }}>
            The journal, timeline, evidence vault, voice notes, escalation detector, quick exit — all of it. Forever. No card, no catch.
          </p>
          <button onClick={() => setStep("state")} className="btn-primary" style={{ marginTop: 12 }}>Continue</button>
        </div>
      )}

      {step === "state" && (
        <div className="card-pp space-y-4">
          <h1 className="font-serif text-[28px]">Which state are you in?</h1>
          <p className="text-[14px]">So I can show you the right legal resources and recording laws.</p>
          <select value={state} onChange={(e) => setState(e.target.value)} className="input-pp">
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={finishAll} className="btn-primary">Open my space</button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label-eyebrow">{label}</label>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="input-pp mt-1 text-center text-[20px] tracking-[0.5em]"
        placeholder="••••"
      />
    </div>
  );
}
