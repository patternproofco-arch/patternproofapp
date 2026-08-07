import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, BellOff, DoorOpen, FileCheck, Phone, Scale, ShieldCheck, Smartphone } from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import { usePinLock } from "@/lib/pin-lock";
import { supabase } from "@/integrations/supabase/client";
import { QuickExitButton } from "@/components/QuickExitButton";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";
import { US_STATES } from "@/lib/state-resources";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { update } = useSettings();
  const { setRealPin } = usePinLock();
  const [pin, setPin] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeLegalUse, setAgreeLegalUse] = useState(false);

  const ready = agreePrivacy && agreeTerms && agreeLegalUse;

  const finishAll = async () => {
    if (!ready) {
      toast("Please read and check all three items above to continue.");
      return;
    }
    setBusy(true);
    try {
      if (pin.length === 4) await setRealPin(pin);
      update({ state, city: city.trim(), onboarded: true });
      await supabase.auth.updateUser({
        data: {
          onboarding_complete: true,
          state,
          city: city.trim(),
          agreed_privacy_at: new Date().toISOString(),
          agreed_terms_at: new Date().toISOString(),
          acknowledged_legal_use_at: new Date().toISOString(),
        },
      });
      navigate({ to: "/dashboard", replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-2xl px-5 py-10 md:py-14">
      <div className="mb-6 flex items-center justify-between">
        <BrandMark size={40} />
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
            PatternProof works best on a device <strong>only you</strong> use — a personal phone or
            a private browser the other person can't open.
          </p>
          <p>
            If you share this device, use a private/incognito window and tap <em>Quick Exit</em> the
            moment anyone walks in.
          </p>
        </StepCard>

        <StepCard icon={<AlertTriangle size={20} />} title="If you are in danger right now">
          <div className="rounded-[2px] p-4" style={{ background: "var(--tint-purple)", border: "1px solid var(--border)" }}>
            <div className="mb-2 inline-flex items-center gap-2 text-[14px]" style={{ color: "var(--foreground)" }}>
              <Phone size={14} /> <strong>Call 911</strong> (US emergency)
            </div>
            <div className="text-[14px]"><strong>National DV Hotline:</strong> 1-800-799-7233 · text START to 88788</div>
          </div>
          <p>
            PatternProof is <strong>not a crisis service</strong> and not a law firm. We help you
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

        <StepCard icon={<ShieldCheck size={20} />} title="What PatternProof is — and isn't">
          <p>
            PatternProof helps you <strong>document patterns</strong> so a court, attorney, or
            advocate can see what's actually happening over time.
          </p>
          <p>
            We are <strong>not a law firm</strong>, we don't give legal advice, and we are not a
            crisis service. Use us alongside a DV-trained attorney or advocate when you can.
          </p>
        </StepCard>

        <StepCard icon={<Scale size={20} />} title="This record can end up in a courtroom">
          <p>
            This is the most important thing on this page, so please read it slowly.
          </p>
          <p>
            What you write here is <strong>a record</strong>. If you share it with an attorney, file
            it with a court, or it becomes part of a legal case, it can be{" "}
            <strong>requested by the other side</strong> and read by their lawyer, by a judge, and
            sometimes by the other person themselves. That is true of your entries, your uploaded
            files, and your voice notes.
          </p>
          <p>
            That is not a reason to stop. It's the reason this app exists — a clear, dated,
            consistent record is what makes you credible. But it does mean two things:
          </p>
          <ul className="ml-4 list-disc space-y-1.5 text-[14px]">
            <li>
              <strong>Write what happened, not what you feel about the person.</strong> Facts,
              dates, and details hold up. Insults don't.
            </li>
            <li>
              <strong>Don't write anything you'd be unwilling to explain out loud.</strong> Editing
              or deleting an entry later doesn't guarantee it disappears from a case once it has
              been shared.
            </li>
          </ul>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Nothing leaves your account until you choose to share it. You control who gets access,
            and you can revoke it at any time.
          </p>
        </StepCard>

        <StepCard icon={<ShieldCheck size={20} />} title="Where are you?">
          <p className="text-[14px]">
            Only used to filter the resources list. You never have to answer this.
          </p>
          <label className="label-eyebrow">State</label>
          <select value={state} onChange={(e) => setState(e.target.value)} className="input-pp w-full">
            <option value="">Prefer not to say</option>
            {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          <label className="label-eyebrow">City — optional</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="input-pp w-full"
            placeholder="Leave blank if you'd rather not"
          />
        </StepCard>

        <StepCard icon={<FileCheck size={20} />} title="Agree to continue">
          <p className="text-[14px]">
            Three boxes to check before we open your space.
          </p>
          <label className="flex items-start gap-2 text-[14px] cursor-pointer">
            <input
              type="checkbox"
              checked={agreeLegalUse}
              onChange={(e) => setAgreeLegalUse(e.target.checked)}
              className="mt-1"
            />
            <span>
              I understand that anything I record here may be used in a legal case and may be seen
              by the other side, their attorney, or a judge.
            </span>
          </label>
          <label className="flex items-start gap-2 text-[14px] cursor-pointer">
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
              className="mt-1"
            />
            <span>
              I have read and agree to the{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                Privacy Policy
              </a>.
            </span>
          </label>
          <label className="flex items-start gap-2 text-[14px] cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1"
            />
            <span>
              I agree to the{" "}
              <a href="/terms" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                Terms of Service
              </a>.
            </span>
          </label>
        </StepCard>
      </div>

      <div className="sticky bottom-4 z-10 mt-6">
        <button
          onClick={finishAll}
          disabled={busy || !ready}
          className="btn-primary w-full"
          style={{ opacity: busy || !ready ? 0.6 : 1 }}
        >
          {busy ? "One moment…" : ready ? "Open my space" : "Check the three items above to continue"}
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
