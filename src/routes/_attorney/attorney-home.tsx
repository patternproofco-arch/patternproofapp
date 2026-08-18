import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList, FileSearch, FileText, Home, Inbox, ScanSearch, Send,
  TrendingUp, User, Users, type LucideIcon,
} from "lucide-react";
import {
  PortalHeader, HeroStatCard, IconTileGrid, RecentActivityFeed, PortalBottomTabBar,
  type PortalVariant,
} from "@/components/shared";
import type { SharedActivityItem } from "@/components/shared/RecentActivityFeed";
import { getAttorneyHome, type AttorneyHome } from "@/lib/attorney-dashboard.functions";

export const Route = createFileRoute("/_attorney/attorney-home")({
  head: () => ({
    meta: [
      { title: "PatternProof — Attorney portal home" },
      { name: "description", content: "Active matters, new client submissions and recent case activity for your firm." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AttorneyHomePage,
});

const VARIANT: PortalVariant = "attorney";

const TABS = [
  { icon: Home as LucideIcon, label: "Home", href: "/attorney-home" },
  { icon: Users as LucideIcon, label: "Matters", href: "/clients" },
  { icon: ClipboardList as LucideIcon, label: "Caseload", href: "/caseload" },
  { icon: ScanSearch as LucideIcon, label: "Conflicts", href: "/conflict-check" },
  { icon: User as LucideIcon, label: "Profile", href: "/trust" },
];

const ICON_FOR: Record<AttorneyHome["activity"][number]["kind"], LucideIcon> = {
  evidence: Inbox as LucideIcon,
  pattern: TrendingUp as LucideIcon,
  export: Send as LucideIcon,
  request: FileText as LucideIcon,
};

function AttorneyHomePage() {
  const homeFn = useServerFn(getAttorneyHome);
  const [data, setData] = useState<AttorneyHome | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    homeFn()
      .then((d) => { setData(d); setError(null); })
      .catch(() => setError("We couldn't open your portal home just now. Try again in a moment."));
  }, [homeFn]);

  const { deltaLabel, deltaDirection } = useMemo(() => {
    if (!data) return { deltaLabel: undefined, deltaDirection: "flat" as const };
    const { new_this_month: a, new_last_month: b } = data.cases;
    if (b > 0) {
      const pct = Math.round(((a - b) / b) * 100);
      return {
        deltaLabel: `${pct > 0 ? "+" : ""}${pct}% vs last month`,
        deltaDirection: (pct > 0 ? "up" : pct < 0 ? "down" : "flat") as "up" | "down" | "flat",
      };
    }
    if (a > 0) return { deltaLabel: `${a} new this month`, deltaDirection: "up" as const };
    return { deltaLabel: undefined, deltaDirection: "flat" as const };
  }, [data]);

  const activity: SharedActivityItem[] | null = data
    ? data.activity.map((a) => ({
        id: a.id,
        icon: ICON_FOR[a.kind] ?? (ClipboardList as LucideIcon),
        title: a.title,
        subtitle: a.subtitle ?? undefined,
        timestamp: a.timestamp,
      }))
    : null;

  const tiles = [
    { icon: Users as LucideIcon, label: "My matters", href: "/clients", count: data?.cases.active },
    { icon: Inbox as LucideIcon, label: "New submissions", href: "/clients", count: data?.counts.new_submissions },
    { icon: FileSearch as LucideIcon, label: "Evidence to review", href: "/clients", count: data?.counts.evidence_to_review },
    { icon: TrendingUp as LucideIcon, label: "Recurrence summaries", href: "/clients", count: data?.counts.clients_with_patterns },
    { icon: FileText as LucideIcon, label: "Document requests", href: "/clients", count: data?.counts.open_document_requests },
    { icon: ScanSearch as LucideIcon, label: "Conflict check", href: "/conflict-check" },
  ];

  const name = data?.profile?.full_name?.trim() || null;
  const firm = data?.profile?.firm_name?.trim() || null;

  if (error) return <p style={{ fontSize: 14, color: "var(--att-text-2)" }}>{error}</p>;

  return (
    <div className="pb-24 md:pb-0" style={{ maxWidth: 900 }}>
      <PortalHeader
        variant={VARIANT}
        subtitle="LAWYER PORTAL"
        greeting={name ? `Welcome back, ${name}` : "Welcome back,"}
        subline={
          firm
            ? `${firm} · matters shared with your firm workspace.`
            : "Attorney at Law · matters clients have chosen to share with you."
        }
      />

      <div className="mt-6">
        <HeroStatCard
          variant={VARIANT}
          label="Active cases"
          value={data?.cases.active ?? "—"}
          caption="Active client links visible to you and your firm"
          deltaLabel={deltaLabel}
          deltaDirection={deltaDirection}
          sparklineData={data?.cases.monthly ?? []}
        />
      </div>

      <h2 className="att-eyebrow" style={{ margin: "30px 0 14px" }}>Go to</h2>
      <IconTileGrid variant={VARIANT} items={tiles} ariaLabel="Portal sections" />

      <div className="mt-8">
        <RecentActivityFeed
          variant={VARIANT}
          items={activity}
          viewAllHref="/clients"
          emptyMessage="Nothing yet — activity appears once a client shares records or you request a document."
        />
      </div>

      <p style={{ fontSize: 12, color: "var(--att-muted)", marginTop: 18, lineHeight: 1.5 }}>
        Counts reflect what clients have documented and shared. They are not assessments, and PatternProof
        draws no legal conclusions.
      </p>

      <PortalBottomTabBar items={TABS} variant={VARIANT} />
    </div>
  );
}
