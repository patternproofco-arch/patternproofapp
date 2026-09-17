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

interface AccessRow {
  id: string;
  who: string;
  what: string;
  manageTo: "/share-with-attorney" | "/share-with-advocate";
}

const SECTIONS: Array<{ to: string; title: string; body: string }> = [
  {
    to: "/case-builder",
    title: "What is included",
    body: "Choose the Marks and files that belong in this case.",
  },
  {
    to: "/court-packet",
    title: "The packet",
    body: "Build a printable record from what you selected.",
  },
  {
    to: "/communications",
    title: "Communication log",
    body: "Keep contact and messages alongside the record.",
  },
  {
    to: "/court-dates",
    title: "Dates and hearings",
    body: "Note what is coming up so nothing is lost.",
  },
];

function CaseHub() {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [att, adv] = await Promise.all([
        supabase
          .from("attorney_client_links")
          .select("id,include_all_incidents,include_all_evidence")
          .eq("client_user_id", user.id)
          .eq("status", "active"),
        supabase
          .from("advocate_client_links")
          .select("id,status")
          .eq("client_user_id", user.id)
          .eq("status", "active"),
      ]);
      const rows: AccessRow[] = [
        ...(
          (att.data ?? []) as Array<{
            id: string;
            include_all_incidents: boolean | null;
            include_all_evidence: boolean | null;
          }>
        ).map((r) => ({
          id: `att-${r.id}`,
          who: "Your attorney",
          what:
            r.include_all_incidents && r.include_all_evidence
              ? "records and files"
              : "only what you selected",
          manageTo: "/share-with-attorney" as const,
        })),
        ...((adv.data ?? []) as Array<{ id: string }>).map((r) => ({
          id: `adv-${r.id}`,
          who: "Your advocate",
          what: "only what you granted",
          manageTo: "/share-with-advocate" as const,
        })),
      ];
      setAccess(rows);
    })();
  }, [user]);

  return (
    <div>
      <div className="label-eyebrow">Case</div>
      <h1 className="mt-2 max-w-[640px] font-serif text-[34px] leading-tight">
        Everything for court, <em>in one place.</em>
      </h1>
      <p className="mt-3 max-w-[640px] text-[14px]" style={{ color: "var(--ink-muted)" }}>
        Build your case, print a packet, log communications, track hearings, and decide what anyone
        else can see. All of it is yours whether or not anyone else is involved.
      </p>

      <div className="mt-6">
        <HubTabs tabs={CASE_TABS} />
      </div>

      <div className="mt-8 grid gap-4">
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to} className="card-pp block" style={{ textDecoration: "none" }}>
            <div className="font-serif text-[18px]" style={{ color: "var(--ink)" }}>
              {s.title}
            </div>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
              {s.body}
            </p>
          </Link>
        ))}
      </div>

      <section className="mt-8">
        <div className="label-eyebrow">Who can see this</div>
        {access.length === 0 ? (
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            No one else can see this case right now. Nothing is shared until you say so.
          </p>
        ) : (
          <ul className="mt-3 grid gap-0" style={{ borderTop: "1px solid var(--rule)" }}>
            {access.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline justify-between gap-3 py-3"
                style={{ borderBottom: "1px solid var(--rule)" }}
              >
                <span className="text-[14px]" style={{ color: "var(--ink)" }}>
                  {a.who}
                </span>
                <span className="mono-meta mono-meta--muted">{a.what}</span>
                <Link to={a.manageTo} style={{ fontSize: 13, color: "var(--ink)" }}>
                  End access
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/access"
          className="mt-3 inline-block text-[13px]"
          style={{ color: "var(--ink)" }}
        >
          Review everyone with access →
        </Link>
      </section>
    </div>
  );
}
