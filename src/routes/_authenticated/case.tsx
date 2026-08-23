import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HubTabs, CASE_TABS } from "@/components/HubTabs";

export const Route = createFileRoute("/_authenticated/case")({
  head: () => ({
    meta: [
      { title: "Your case — PatternProof" },
      {
        name: "description",
        content:
          "Case builder, court packet, communication log, court dates, and attorney sharing in one place.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CaseHub,
});

function CaseHub() {
  const { user } = useAuth();
  const [attorneyConnected, setAttorneyConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("attorney_client_links")
        .select("id")
        .eq("client_user_id", user.id)
        .eq("status", "active")
        .limit(1);
      setAttorneyConnected((data ?? []).length > 0);
    })();
  }, [user]);

  return (
    <div>
      <div className="label-eyebrow">Case</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Everything for court, <em>in one place.</em>
      </h1>
      <p className="mt-3 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Build your case, print a packet, log communications, track hearings, and decide what an
        attorney can see. All of it is yours whether or not anyone else is involved.
      </p>

      <div className="mt-6">
        <HubTabs tabs={CASE_TABS} />
      </div>

      {attorneyConnected && (
        <div
          className="mb-6 flex items-start gap-2 rounded-2xl p-3 text-[13px]"
          style={{ background: "var(--input)", boxShadow: "var(--pp-shadow-sm)" }}
        >
          <CheckCircle2 size={16} style={{ color: "var(--accent)", marginTop: 1 }} />
          <span>
            Your attorney can now see this case. You can change or stop what they see anytime in{" "}
            <Link to="/share-with-attorney" style={{ textDecoration: "underline" }}>
              Share with attorney
            </Link>
            .
          </span>
        </div>
      )}
    </div>
  );
}
