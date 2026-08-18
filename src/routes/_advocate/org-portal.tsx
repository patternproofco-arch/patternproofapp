import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, BookOpen, ClipboardList, Clock, Home, Share2, Users, User,
  type LucideIcon,
} from "lucide-react";
import {
  PortalHeader, HeroStatCard, IconTileGrid, RecentActivityFeed, PortalBottomTabBar,
  type PortalVariant,
} from "@/components/shared";
import type { SharedActivityItem } from "@/components/shared/RecentActivityFeed";
import { getAdvocateDashboard, type AdvocateDashboard } from "@/lib/advocate-dashboard.functions";

export const Route = createFileRoute("/_advocate/org-portal")({
  head: () => ({
    meta: [
      { title: "PatternProof — DV organization portal" },
      { name: "description", content: "Referral, consent and follow-up overview for PatternProof DV organization partners." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrgPortalHome,
});

const VARIANT: PortalVariant = "advocate";

const TABS = [
  { icon: Home as LucideIcon, label: "Home", href: "/org-portal" },
  { icon: Users as LucideIcon, label: "Clients", href: "/advocate-cases" },
  { icon: Share2 as LucideIcon, label: "Referrals", href: "/org/referrals" },
  { icon: BookOpen as LucideIcon, label: "Resources", href: "/org/resources" },
  { icon: User as LucideIcon, label: "Profile", href: "/org/settings" },
];

const ICON_FOR: Record<string, LucideIcon> = {
  client_link: Users as LucideIcon,
  follow_up: Clock as LucideIcon,
  audit: ClipboardList as LucideIcon,
};

function OrgPortalHome() {
  const dashFn = useServerFn(getAdvocateDashboard);
  const [data, setData] = useState<AdvocateDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashFn()
      .then((d) => { setData(d); setError(null); })
      .catch(() => setError("We couldn't open your dashboard. Try again in a moment."));
  }, [dashFn]);

  const { deltaLabel, deltaDirection } = useMemo(() => {
    if (!data) return { deltaLabel: undefined, deltaDirection: "flat" as const };
    const { new_this_month: a, new_last_month: b } = data.clients;
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
    { icon: Share2 as LucideIcon, label: "Referrals", href: "/org/referrals", count: data?.referral_links },
    { icon: Users as LucideIcon, label: "Active clients", href: "/advocate-cases", count: data?.clients.active },
    { icon: Clock as LucideIcon, label: "Follow-ups", href: "/org/follow-ups", count: data?.open_follow_ups },
    { icon: BookOpen as LucideIcon, label: "Resources", href: "/org/resources" },
    { icon: ClipboardList as LucideIcon, label: "Record requests", href: "/org/record-requests", count: data?.record_requests },
    { icon: BarChart3 as LucideIcon, label: "Reports", href: "/org/reports" },
  ];

  const name = data?.profile?.org_name?.trim() || data?.profile?.full_name?.trim() || null;

  if (error) {
    return (
      <>
        <p style={{ fontSize: 15 }}>{error}</p>
      </>
    );
  }

  return (
    <div className="pb-24 md:pb-0">
      <PortalHeader
        variant={VARIANT}
        subtitle="DV ORGANIZATION PORTAL"
        greeting={name ? `Welcome back, ${name}` : "Welcome back,"}
        subline="Referral, consent and follow-up status in one place. Nothing a survivor documents appears here unless they have chosen to share it with you."
      />

      <div className="mt-6">
        <HeroStatCard
          variant={VARIANT}
          label="Clients Supported"
          value={data?.clients.active ?? "—"}
          caption="Workspaces shared with you right now"
          deltaLabel={deltaLabel}
          deltaDirection={deltaDirection}
          sparklineData={data?.clients.weekly ?? []}
        />
      </div>

      <h2 className="orgx-eyebrow" style={{ margin: "30px 0 14px" }}>Go to</h2>
      <IconTileGrid variant={VARIANT} items={tiles} ariaLabel="Portal sections" />

      <div className="mt-8">
        <RecentActivityFeed
          variant={VARIANT}
          items={activity}
          viewAllHref="/advocate-cases"
          emptyMessage="Nothing here yet — activity appears once someone shares a workspace with you or you log a follow-up."
        />
      </div>

      <p className="orgx-muted" style={{ fontSize: 12.5, marginTop: 18 }}>
        Referral totals are counts only — no names, no dates of birth, and nothing a survivor has written.
      </p>

      <PortalBottomTabBar items={TABS} variant={VARIANT} />
    </div>
  );
}
