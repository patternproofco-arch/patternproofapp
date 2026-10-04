import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, DoorOpen, FileCheck, Scale, Smartphone } from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import { supabase } from "@/integrations/supabase/client";
import { QuickExitButton } from "@/components/QuickExitButton";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";
import { completeSurvivorOnboarding } from "@/lib/legal-consent.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { update } = useSettings();
  const [busy, setBusy] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeLegalUse, setAgreeLegalUse] = useState(false);
  const completeOnboarding = useServerFn(completeSurvivorOnboarding);

  const ready = agreePrivacy && agreeTerms && agreeLegalUse;

  /**
   * Only what is needed to open an account lives here: a short safety note and the agreements.
   * Location, a lock code, home-screen tips and everything optional are offered later, in
   * Settings and Resources, when they're useful. Finishing does not require writing anything.
   */
  const finishAll = async () => {
    if (!ready) {
      toast("Please check all three boxes to continue.");
      return;
    }
    setBusy(true);
    try {
      // Fail closed before any server write if the browser session is gone —
      // avoids calling the serverFn without a bearer token.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Your session expired. Please sign in again to finish setup.");
      }

      await completeOnboarding({ data: { accepted: true, state: "", city: "" } });

      // Refresh so local user_metadata picks up onboarding_complete from the
      // admin write (client updateUser is no longer used for this path).
      await supabase.auth.refreshSession().catch(() => undefined);

      update({ onboarded: true });

      // If they arrived from an invite link, take them back to finish it.
      let returnTo: string | null = null;
      try {
        returnTo = sessionStorage.getItem("pp_return_to");
        sessionStorage.removeItem("pp_return_to");
      } catch {
        returnTo = null;
      }
      if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        window.location.replace(returnTo);
        return;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not securely save your acceptance. Please try again.";
      const needsReauth = /session|unauthorized|sign in again/i.test(message);
      toast.error(
        needsReauth ? "Your session expired. Please sign in again to finish setup." : message,
      );
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
        <h1
          className="font-serif text-[28px] leading-tight md:text-[34px]"
          style={{ color: "var(--foreground)" }}
        >
          Two minutes, then it&apos;s yours
        </h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          A few safety notes and three boxes to check. You don&apos;t have to write anything to
          finish.
        </p>
      </div>

      <div className="space-y-4">
        <StepCard icon={<Smartphone size={20} />} title="Is this device safe?">
          <p>
            PatternProof works best on a device <strong>only you</strong> use. If someone else can
            open this device or see its history, use a private window.
          </p>
        </StepCard>

        <StepCard icon={<DoorOpen size={20} />} title="The Quick Exit button">
          <p>
            <strong>Quick Exit</strong> is at the top of every screen. It signs you out and sends
            this tab to a normal page (weather, by default). It&apos;s fast.
          </p>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            It does <strong>not</strong> erase your browser history, remove the app from your
            device, or stop monitoring software or someone who can see your screen. If you may be
            watched, use a private window and a device you trust.
          </p>
        </StepCard>

        <StepCard icon={<AlertTriangle size={20} />} title="If you are in danger right now">
          <p>
            <strong>Call 911</strong> (US). National DV Hotline: <strong>1-800-799-7233</strong>,
            or text START to 88788. PatternProof is not a crisis service and not a law firm. It
            helps you keep a record.
          </p>
        </StepCard>

        <StepCard icon={<Scale size={20} />} title="Your record, your choice">
          <p>
            Everything you add is <strong>private to you</strong>. Nothing is shared unless you
            choose to share it, with the person you choose, and you can end sharing any time.
          </p>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            If you share something, or it becomes part of a legal case, it can end up in front of
            others, including the other side. Ending sharing later can&apos;t take back copies
            someone already saved or downloaded.
          </p>
        </StepCard>

        <StepCard icon={<FileCheck size={20} />} title="Agree to continue">
          <label className="flex cursor-pointer items-start gap-2 text-[14px]">
            <input
              type="checkbox"
              checked={agreeLegalUse}
              onChange={(e) => setAgreeLegalUse(e.target.checked)}
              className="mt-1"
            />
            <span>
              I understand that what I record here may be used in a legal case, and could be seen
              by the other side, their attorney, or a judge if I share it or it becomes part of a
              case.
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-[14px]">
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
              </a>
              .
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-[14px]">
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
              </a>
              .
            </span>
          </label>
          <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            This is only your account agreement. Choosing to share with an attorney or advocate is a
            separate decision you make later, and you won&apos;t receive marketing unless you ask.
            You can set a lock code, add your state for local resources, and change other options
            any time in Settings.
          </p>
        </StepCard>
      </div>

      <div className="sticky bottom-4 z-10 mt-6">
        <button
          onClick={finishAll}
          disabled={busy || !ready}
          className="btn-primary w-full"
          style={{ opacity: busy || !ready ? 0.6 : 1 }}
        >
          {busy ? "One moment…" : ready ? "Open my space" : "Check the three boxes above to continue"}
        </button>
      </div>
    </div>
  );
}

function StepCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-pp space-y-4">
      <div className="flex items-center gap-2" style={{ color: "var(--primary)" }}>
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "var(--tint-teal)" }}
        >
          {icon}
        </span>
        <h2 className="font-serif text-[24px] leading-tight" style={{ margin: 0 }}>
          {title}
        </h2>
      </div>
      <div className="space-y-3 text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}
