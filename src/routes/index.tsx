import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Hero } from "@/components/landing/Hero";
import { SurvivorSection } from "@/components/landing/SurvivorSection";
import { AttorneySection } from "@/components/landing/AttorneySection";
import { OrgSection } from "@/components/landing/OrgSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { FinalCTA } from "@/components/landing/FinalCTA";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "P4TTERN PR00F — Turn scattered evidence into structured patterns" },
      { name: "description", content: "P4TTERN PR00F turns scattered incidents, evidence, and timelines into organized patterns survivors can document, attorneys can review, and advocates can understand faster." },
      { property: "og:title", content: "P4TTERN PR00F — The proof is in the patterns." },
      { property: "og:description", content: "Pattern infrastructure for DV, custody, and coercive control documentation." },
      { property: "og:url", content: "https://pattern-proof.tech/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "P4TTERN PR00F — The proof is in the patterns." },
      { name: "twitter:description", content: "Turn scattered evidence into structured patterns." },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "P4TTERN PR00F",
          description:
            "Pattern infrastructure for survivors, attorneys, and DV organizations. Turn scattered incidents, evidence, and timelines into organized patterns.",
          brand: { "@type": "Brand", name: "P4TTERN PR00F" },
          url: "https://pattern-proof.tech/",
          offers: [
            { "@type": "Offer", name: "Survivor — Free", price: "0", priceCurrency: "USD", url: "https://pattern-proof.tech/login", availability: "https://schema.org/InStock" },
            { "@type": "Offer", name: "Attorney Solo", price: "297", priceCurrency: "USD", url: "https://pattern-proof.tech/for-attorneys", availability: "https://schema.org/InStock" },
            { "@type": "Offer", name: "DV Organization — Invite", price: "0", priceCurrency: "USD", url: "https://pattern-proof.tech/for-organizations", availability: "https://schema.org/LimitedAvailability" },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="label-eyebrow">Preparing your space…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Hero />
      <SurvivorSection />
      <AttorneySection />
      <OrgSection />
      <SocialProofSection />
      <FinalCTA />
    </div>
  );
}
