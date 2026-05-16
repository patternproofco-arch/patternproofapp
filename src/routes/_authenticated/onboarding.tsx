import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings-context";
import { usePinLock } from "@/lib/pin-lock";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const DISGUISES = ["Daily Planner", "Budget Tracker", "Recipe Book", "Fitness Log", "Notes"];
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function Onboarding() {
  const navigate = useNavigate();
  const { update } = useSettings();
  const { setRealPin, setDecoyPin } = usePinLock();
  const [step, setStep] = useState(0);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [decoy, setDecoy] = useState("");
  const [contact, setContact] = useState("");
  const [disguise, setDisguise] = useState("Daily Planner");
  const [state, setState] = useState("NJ");

  const finishPin = async () => {
    if (pin.length !== 6 || pin !== pin2) { toast("Codes don't match. Try again."); return; }
    if (decoy.length !== 6) { toast("Set a 6-digit decoy code."); return; }
    if (decoy === pin) { toast("Your decoy code can't match your real code."); return; }
    await setRealPin(pin);
    await setDecoyPin(decoy);
    if (contact) try { localStorage.setItem("pp_trusted_contact_v1", contact); } catch { /* */ }
    setStep(2);
  };

  const finishAll = () => {
    update({ disguiseName: disguise, state, onboarded: true });
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 md:py-16">
      {step === 0 && (
        <div className="card-pp space-y-4">
          <h1 className="font-serif text-[28px]">Before you begin — a few things about your safety.</h1>
          <div className="space-y-3 text-[14px] leading-relaxed">
            <p>This app stores your records securely in the cloud, not on this device. However, if someone has access to your account login, they could access your records.</p>
            <p>Use a password your partner has never seen. Do not use this app on a shared device.</p>
            <p>If you think your device is being monitored, use a library computer or a trusted friend's device instead.</p>
            <p>You can delete everything in this app instantly at any time from Settings.</p>
            <p>If you are in immediate danger, call <strong>911</strong>. National DV Hotline: <strong>1-800-799-7233</strong>.</p>
          </div>
          <button onClick={() => setStep(1)} className="btn-primary">I understand, let's begin</button>
        </div>
      )}

      {step === 1 && (
        <div className="card-pp space-y-4">
          <h1 className="font-serif text-[28px]">Set your access code</h1>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Do not use a code your partner might guess — birthdays, anniversaries, or repeated numbers.
          </p>
          <Field label="6-digit access code" value={pin} onChange={setPin} />
          <Field label="Confirm access code" value={pin2} onChange={setPin2} />
          <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <p className="text-[13px] mb-2">
              Set a second code that opens an empty version of the app. If someone asks to see your phone, enter this code instead.
            </p>
            <Field label="Decoy code" value={decoy} onChange={setDecoy} />
          </div>
          <div>
            <label className="label-eyebrow">Trusted contact phone (optional)</label>
            <input className="input-pp mt-1" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="For account recovery only" />
          </div>
          <button onClick={finishPin} className="btn-primary">Continue</button>
        </div>
      )}

      {step === 2 && (
        <div className="card-pp space-y-4">
          <h1 className="font-serif text-[28px]">Would you like to disguise this app?</h1>
          <p className="text-[14px]">Choose a name that won't raise questions.</p>
          <div className="flex flex-wrap gap-2">
            {DISGUISES.map((d) => (
              <button key={d} onClick={() => setDisguise(d)} className="rounded-full px-4 py-2 text-[13px] font-semibold"
                style={{ background: disguise === d ? "var(--primary)" : "transparent", color: disguise === d ? "var(--primary-foreground)" : "var(--foreground)", border: "1.5px solid var(--primary)" }}>
                {d}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(3)} className="btn-primary">Continue</button>
        </div>
      )}

      {step === 3 && (
        <div className="card-pp space-y-4">
          <h1 className="font-serif text-[28px]">Which state are you in?</h1>
          <p className="text-[14px]">This helps us show you the right legal resources and recording laws.</p>
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
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="input-pp mt-1 text-center text-[20px] tracking-[0.5em]"
        placeholder="••••••"
      />
    </div>
  );
}