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
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
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
