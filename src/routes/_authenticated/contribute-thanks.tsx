import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_authenticated/contribute-thanks")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: ContributeThanks,
});

function ContributeThanks() {
  const sub = useSubscription();
  const navigate = useNavigate();
  const { session_id } = Route.useSearch();

  // Keep the latest `sub` in a ref. useSubscription() returns a new object
  // identity on every refetch, and this effect used to depend on `sub`
  // directly — so every 1.5s refetch tore the effect down and rebuilt it,
  // which reset the 10s fallback timer each time. A slow/failed tier
  // update meant the timer never actually elapsed and the user could be
  // stuck on "Confirming your payment…" forever. Reading through a ref
  // keeps the interval/timeout stable across refetches.
  const subRef = useRef(sub);
  subRef.current = sub;

  useEffect(() => {
    // No session_id means this route wasn't reached from a real Stripe
    // redirect (e.g. someone hit the URL directly, or a stale bookmark).
    // Don't thank them for a contribution that may not have happened —
    // just send them on.
    if (!session_id) {
      navigate({ to: "/court-packet", replace: true });
      return;
    }

    let settled = false;
    const poll = setInterval(() => subRef.current.refetch(), 1500);

    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearInterval(watcher);
      clearTimeout(timeout);
      toast.success("Thank you for contributing.", {
        description: "Your court packet, exports, and Recurline were already free and stay free.",
      });
      navigate({ to: "/court-packet", replace: true });
    };

    const giveUp = () => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearInterval(watcher);
      // Route through regardless — the app itself still works — but don't
      // falsely claim the contribution was confirmed if we never saw the
      // tier update.
      navigate({ to: "/court-packet", replace: true });
    };

    // Give the webhook up to 10s to land, then bail out either way.
    const timeout = setTimeout(giveUp, 10_000);

    const watcher = setInterval(() => {
      const tier = subRef.current.tier;
      const ready =
        tier === "court_ready" || tier === "solo" || tier === "firm" || tier === "enterprise";
      if (ready) finish();
    }, 500);

    return () => {
      settled = true;
      clearInterval(poll);
      clearInterval(watcher);
      clearTimeout(timeout);
    };
    // subRef.current always has the latest `sub` — intentionally not a dep,
    // since `sub` is a fresh object on every refetch.
  }, [session_id, navigate]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="card-pp flex flex-col items-center gap-3 rounded-2xl text-center">
        <div className="label-eyebrow" aria-live="polite">
          Confirming your payment…
        </div>
      </div>
    </div>
  );
}
