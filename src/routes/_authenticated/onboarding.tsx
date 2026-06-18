import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, BellOff, DoorOpen, Phone, ShieldCheck, Smartphone } from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import { usePinLock } from "@/lib/pin-lock";
import { QuickExitButton } from "@/components/QuickExitButton";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

type Step =
  | "device"
  | "emergency"
  | "exit"
  | "notifications"
  | "pin"
  | "scope"
  | "state";

const ORDER: Step[] = ["device", "emergency", "exit", "notifications", "pin", "scope", "state"];

function Onboarding() {
  const navigate = useNavigate();
  const { update } = useSettings();
  const { setRealPin } = usePinLock();
  const [step, setStep] = useState<Step>("device");
  const [pin, setPin] = useState("");
  const [state, setState] = useState("NJ");

  const next = () => {
    const i = ORDER.indexOf(step);
    if (i < ORDER.length - 1) setStep(ORDER[i + 1]);
  };

  const finishPin = async () => {
    if (pin.length === 4) await setRealPin(pin);
    next();
  };

  const finishAll = () => {
    update({ state, onboarded: true });
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="relative mx-auto max-w-2xl px-5 py-10 md:py-14">
      {/* Quick Exit visible from the very first screen */}
      <div className="mb-4 flex justify-end">
        <QuickExitButton />
      </div>

      <Progress step={ORDER.indexOf(step) + 1} total={ORDER.length} />

      {step === "device" && (
        <StepCard icon={<Smartphone size={20} />} title="Is this device safe?">
          <p>
            PatternProof works best on a device <strong>only you</strong> use — a personal phone or
            a private browser the other person can't open.
          </p>
          <p>
            If you share this device, use a private/incognito window and tap <em>Quick Exit</em> the
            moment anyone walks in. We'll show you that next.
          </p>
          <Actions onNext={next} nextLabel="My device is safe enough" />
        </StepCard>
      )}

      {step === "emergency" && (
        <StepCard icon={<AlertTriangle size={20} />} title="If you are in danger right now">
          <div className="rounded-2xl p-4" style={{ background: "var(--tint-purple)", border: "1px solid var(--border)" }}>
            <div className="mb-2 inline-flex items-center gap-2 text-[14px]" style={{ color: "var(--foreground)" }}>
              <Phone size={14} /> <strong>Call 911</strong> (US emergency)
            </div>
            <div className="text-[14px]"><strong>National DV Hotline:</strong> 1-800-799-7233 · text START to 88788</div>
          </div>
          <p>
            PatternProof is <strong>not a crisis service</strong> and not a law firm. We help you
            document patterns over time. If you need help right now, please reach a real person.
          </p>
          <Actions onNext={next} nextLabel="I understand" />
        </StepCard>
      )}

      {step === "exit" && (
        <StepCard icon={<DoorOpen size={20} />} title="The Quick Exit button">
          <p>
            At the top of every screen there's a <strong>Quick Exit</strong> button. Tap it and the
            app instantly replaces itself with a normal-looking page (weather, by default).
          </p>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Try it now if you'd like — you can come right back to this onboarding. You can change the cover page in Settings.
          </p>
          <Actions onNext={next} nextLabel="Got it" />
        </StepCard>
      )}

      {step === "notifications" && (
        <StepCard icon={<BellOff size={20} />} title="No surprise notifications">
          <p>
            We <strong>never</strong> send push notifications that could appear on your lock screen.
            Email is opt-in only and we use a neutral sender name and subject line.
          </p>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            You stay in control of what shows up on this device.
          </p>
          <Actions onNext={next} nextLabel="Continue" />
        </StepCard>
      )}

      {step === "pin" && (
        <StepCard icon={<ShieldCheck size={20} />} title="Set a 4-digit code">
          <p>
            This locks the app the moment you close it. Pick four digits no one would guess —
            not your birthday, not your kids' birthdays.
          </p>
          <PinField value={pin} onChange={setPin} />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button onClick={next} className="btn-ghost text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Skip for now
            </button>
            <button onClick={finishPin} className="btn-primary" disabled={pin.length !== 4}>
              Set my code
            </button>
          </div>
        </StepCard>
      )}

      {step === "scope" && (
        <StepCard icon={<ShieldCheck size={20} />} title="What PatternProof is — and isn't">
          <p>
            PatternProof helps you <strong>document patterns</strong> so a court, attorney, or
            advocate can see what's actually happening over time.
          </p>
          <p>
            We are <strong>not a law firm</strong>, we don't give legal advice, and we are not a
            crisis service. Use us alongside a DV-trained attorney or advocate when you can.
          </p>
          <Actions onNext={next} nextLabel="Makes sense" />
        </StepCard>
      )}

      {step === "state" && (
        <StepCard icon={<ShieldCheck size={20} />} title="One last thing — which state?">
          <p className="text-[14px]">
            So we can show you the right legal resources and recording-consent rules.
          </p>
          <select value={state} onChange={(e) => setState(e.target.value)} className="input-pp">
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex justify-end">
            <button onClick={finishAll} className="btn-primary">Open my space</button>
          </div>
        </StepCard>
      )}
    </div>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="block h-1.5 flex-1 rounded-full"
          style={{ background: i < step ? "var(--primary)" : "rgba(20,23,31,0.08)" }} />
      ))}
    </div>
  );
}

function StepCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card-pp space-y-4">
      <div className="flex items-center gap-2" style={{ color: "var(--primary)" }}>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "var(--tint-teal)" }}>
          {icon}
        </span>
        <h1 className="font-serif text-[24px] leading-tight" style={{ margin: 0 }}>{title}</h1>
      </div>
      <div className="space-y-3 text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

function Actions({ onNext, nextLabel }: { onNext: () => void; nextLabel: string }) {
  return (
    <div className="flex justify-end pt-1">
      <button onClick={onNext} className="btn-primary">{nextLabel}</button>
    </div>
  );
}

function PinField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label-eyebrow">4-digit code</label>
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
