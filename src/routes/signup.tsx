import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth/AuthPage";

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>) => {
    const out: { redirect?: string; ref?: string } = {};
    if (typeof s.redirect === "string") out.redirect = s.redirect;
    if (typeof s.ref === "string") out.ref = s.ref;
    return out;
  },
  head: () => ({
    meta: [
      { title: "PatternProof — Create your account" },
      {
        name: "description",
        content:
          "Create your free PatternProof account to privately document incidents, evidence, and build your case.",
      },
      { property: "og:title", content: "Create your account — PatternProof" },
      {
        property: "og:description",
        content:
          "Private by default. Protected with per-user access controls and encrypted in transit.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/signup" },
      { name: "twitter:title", content: "Create your account — PatternProof" },
      {
        name: "twitter:description",
        content:
          "Private by default. Protected with per-user access controls and encrypted in transit.",
      },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/signup" }],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const { redirect: redirectTo, ref: refSlug } = Route.useSearch();
  return <AuthPage mode="signup" redirectTo={redirectTo} refSlug={refSlug} />;
}
