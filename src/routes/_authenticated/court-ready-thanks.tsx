import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_authenticated/court-ready-thanks")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: CourtReadyThanks,
});

function CourtReadyThanks() {
  const sub = useSubscription();
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    const poll = setInterval(() => sub.refetch(), 1500);
    const finish = () => {
      if (cancelled) return;
      clearInterval(poll);
      toast.success("Professional Review is unlocked.", {
        description: "Your full packet, exports, and pattern analysis are ready.",
      });
      navigate({ to: "/court-packet", replace: true });
    };
    // Try for up to 10s, then route anyway.
    const timeout = setTimeout(finish, 10_000);
    const watcher = setInterval(() => {
      const ready = sub.tier === "court_ready" || sub.tier === "solo" || sub.tier === "firm" || sub.tier === "enterprise";
      if (ready) {
        clearTimeout(timeout);
        clearInterval(watcher);
        finish();
      }
    }, 500);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(watcher);
      clearTimeout(timeout);
    };
  }, [sub, navigate]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="label-eyebrow">Confirming your payment…</div>
    </div>
  );
}