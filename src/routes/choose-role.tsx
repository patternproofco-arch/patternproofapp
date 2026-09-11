import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/choose-role")({
  beforeLoad: () => {
    throw redirect({ to: "/how-it-works" });
  },
  head: () => ({
    meta: [
      { title: "How PatternProof works — PatternProof" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: function ChooseRoleRedirect() {
    return null;
  },
});
