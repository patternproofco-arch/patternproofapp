import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { OrgSection } from "@/components/landing/OrgSection";
import { FinalCTA } from "@/components/landing/FinalCTA";

export const Route = createFileRoute("/for-organizations")({
  head: () => ({
    meta: [
      { title: "For DV organizations — PatternProof" },
      { name: "description", content: "Reduce intake and documentation burden. PatternProof helps advocates serve more survivors with cleaner, pattern-aware case files." },
      { property: "og:title", content: "PatternProof for DV organizations" },
      { property: "og:description", content: "Capacity is care. Cleaner intake. Faster referrals. More survivors served." },
      { property: "og:url", content: "https://pattern-proof.tech/for-organizations" },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/for-organizations" }],
  }),
  component: ForOrganizations,
});

function ForOrganizations() {
  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted-foreground)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
          <ArrowLeft size={16} /> Home
        </Link>
        <Logo variant="org" size={36} />
      </header>
      <OrgSection />
      <FinalCTA />
    </div>
  );
}