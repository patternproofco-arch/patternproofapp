import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PatternProof — Private documentation for your case" },
      { name: "description", content: "PatternProof helps survivors privately document incidents, organize evidence, and build court-ready records — encrypted and only visible to you." },
      { property: "og:title", content: "PatternProof — Private documentation for your case" },
      { property: "og:description", content: "Private, encrypted documentation for survivors of domestic abuse and high-conflict custody cases." },
      { property: "og:url", content: "https://project--f496a23a-1a8f-408f-b5e0-e96d5947d49c.lovable.app/" },
      { name: "twitter:title", content: "PatternProof — Private documentation for your case" },
      { name: "twitter:description", content: "Private, encrypted documentation for survivors of domestic abuse and high-conflict custody cases." },
    ],
    links: [{ rel: "canonical", href: "https://project--f496a23a-1a8f-408f-b5e0-e96d5947d49c.lovable.app/" }],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    navigate({ to: user ? "/dashboard" : "/login", replace: true });
  }, [user, loading, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="label-eyebrow">Preparing your space…</div>
    </div>
  );
}
