import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, BellOff, DoorOpen, Phone, ShieldCheck, Smartphone } from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import { usePinLock } from "@/lib/pin-lock";
import { QuickExitButton } from "@/components/QuickExitButton";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function Onboarding() {
  const navigate = useNavigate();
  const { update } = useSettings();
  const { setRealPin } = usePinLock();
  const [pin, setPin] = useState("");
  const [state, setState] = useState("NJ");
  const [busy, setBusy] = useState(false);

  const finishAll = async () => {
    setBusy(true);
    try {
      if (pin.length === 4) await setRealPin(pin);
      update({ state, onboarded: true });
      navigate({ to: "/dashboard", replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-2xl px-5 py-10 md:py-14">
      <div className="mb-6 flex items-center justify-between">
        <Logo variant="survivor" size={40} />
        <QuickExitButton />
      </div>

      <div className="mb-6 text-center">
        <h1 className="font-serif text-[28px] leading-tight md:text-[34px]" style={{ color: "var(--foreground)" }}>
          Welcome — a few things first
        </h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          Read through, set your code and state, then open your space.
        </p>
      </div>

      <div className="space-y-4">
        <StepCard icon={<Smartphone size={20} />} title="Is this device safe?">
          <p>
            P4TTERN PR00F works best on a device <strong>only you</strong> use — a personal phone or
            a private browser the other person can't open.
          </p>
          <p>
            If you share this device, use a private/incognito window and tap <em>Quick Exit</em> the
            moment anyone walks in.
          </p>
        </StepCard>

        <StepCard icon={<AlertTriangle size={20} />} title="If you are in danger right now">
          <div className="rounded-2xl p-4" style={{ background: "var(--tint-purple)", border: "1px solid var(--border)" }}>
            <div className="mb-2 inline-flex items-center gap-2 text-[14px]" style={{ color: "var(--foreground)" }}>
              <Phone size={14} /> <strong>Call 911</strong> (US emergency)
            </div>
            <div className="text-[14px]"><strong>National DV Hotline:</strong> 1-800-799-7233 · text START to 88788</div>
          </div>
          <p>
            P4TTERN PR00F is <strong>not a crisis service</strong> and not a law firm. We help you
            document patterns over time. If you need help right now, please reach a real person.
          </p>
        </StepCard>

        <StepCard icon={<DoorOpen size={20} />} title="The Quick Exit button">
          <p>
            At the top of every screen there's a <strong>Quick Exit</strong> button. Tap it and the
            app instantly replaces itself with a normal-looking page (weather, by default).
          </p>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            You can change the cover page in Settings.
          </p>
        </StepCard>

        <StepCard icon={<BellOff size={20} />} title="No surprise notifications">
          <p>
            We <strong>never</strong> send push notifications that could appear on your lock screen.
            Email is opt-in only and we use a neutral sender name and subject line.
          </p>
        </StepCard>

        <StepCard icon={<ShieldCheck size={20} />} title="Set a 4-digit code (optional)">
          <p>
            This locks the app the moment you close it. Pick four digits no one would guess —
            not your birthday, not your kids' birthdays. Leave blank to skip.
          </p>
          <PinField value={pin} onChange={setPin} />
        </StepCard>

        <StepCard icon={<ShieldCheck size={20} />} title="What P4TTERN PR00F is — and isn't">
          <p>
            P4TTERN PR00F helps you <strong>document patterns</strong> so a court, attorney, or
            advocate can see what's actually happening over time.
          </p>
          <p>
            We are <strong>not a law firm</strong>, we don't give legal advice, and we are not a
            crisis service. Use us alongside a DV-trained attorney or advocate when you can.
          </p>
        </StepCard>

        <StepCard icon={<ShieldCheck size={20} />} title="Which state are you in?">
          <p className="text-[14px]">
            So we can show you the right legal resources and recording-consent rules.
          </p>
          <select value={state} onChange={(e) => setState(e.target.value)} className="input-pp w-full">
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </StepCard>
      </div>

      <div className="sticky bottom-4 z-10 mt-6">
        <button
          onClick={finishAll}
          disabled={busy}
          className="btn-primary w-full"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "One moment…" : "Open my space"}
        </button>
      </div>
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
