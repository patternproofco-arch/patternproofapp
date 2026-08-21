import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth/AuthPage";

export const Route = createFileRoute("/signin")({
  validateSearch: (s: Record<string, unknown>) => {
    const out: { redirect?: string; ref?: string } = {};
    if (typeof s.redirect === "string") out.redirect = s.redirect;
    if (typeof s.ref === "string") out.ref = s.ref;
    return out;
  },
  head: () => ({
    meta: [
      { title: "PatternProof — Sign in" },
      {
        name: "description",
        content:
          "Sign in to your PatternProof account to privately document incidents, evidence, and build your case.",
      },
      { property: "og:title", content: "Sign in — PatternProof" },
      {
        property: "og:description",
        content:
          "Access your private documentation space. Protected with per-user access controls and encrypted in transit.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/signin" },
      { name: "twitter:title", content: "Sign in — PatternProof" },
      {
        name: "twitter:description",
        content:
          "Access your private documentation space. Protected with per-user access controls and encrypted in transit.",
      },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/signin" }],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { redirect: redirectTo, ref: refSlug } = Route.useSearch();
  return <AuthPage mode="login" redirectTo={redirectTo} refSlug={refSlug} />;
}
