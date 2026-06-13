import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Check } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_authenticated/court-ready-thanks")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: CourtReadyThanks,
});

function CourtReadyThanks() {
  const sub = useSubscription();
  useEffect(() => {
    const t = setInterval(() => sub.refetch(), 2000);
    return () => clearInterval(t);
  }, [sub]);

  const ready = sub.tier === "court_ready" || sub.tier === "solo" || sub.tier === "firm" || sub.tier === "enterprise";

  return (
    <div className="card-pp space-y-3" style={{ maxWidth: 560, margin: "60px auto", textAlign: "center" }}>
      <Check size={36} style={{ color: "var(--accent)", margin: "0 auto" }} />
      <h1 className="font-serif text-[28px]">
        {ready ? "Court Ready is unlocked." : "Finishing up…"}
      </h1>
      <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        {ready
          ? "Your court packet, attorney exports, and full pattern analysis are ready when you are."
          : "Confirming your payment. This usually takes a few seconds."}
      </p>
      <div className="flex gap-2 justify-center pt-2">
        <Link to="/court-packet" className="btn-primary">Build my court packet</Link>
        <Link to="/dashboard" className="btn-ghost">Back to dashboard</Link>
      </div>
    </div>
  );
}