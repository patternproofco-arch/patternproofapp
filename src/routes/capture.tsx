import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";

export const Route = createFileRoute("/capture")({
  head: () => ({
    meta: [
      { title: "Record privately — PatternProof" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Capture,
});

/**
 * This page used to record audio before sign-up. The recording stayed only in the open
 * page, so it was lost on the way to the sign-up screen while the page implied it would be
 * kept. Nothing is recorded here any more: recording happens inside your own account, where
 * it is saved to you the moment you stop. No microphone permission is requested on this page.
 */
function Capture() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--paper, #f4f1ea)", color: "var(--ink, #1a1916)" }}>
      <PublicQuickExit />
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "48px 24px" }}>
        <p className="folio-kicker">Private recording</p>
        <h1 style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: "2rem", fontWeight: 400 }}>
          Record inside your own account.
        </h1>
        <p style={{ color: "var(--ink-muted, #5c574f)", lineHeight: 1.5 }}>
          So that nothing is lost, recordings are made after you sign in and are saved straight to
          your private account. Nothing is recorded or stored on this page.
        </p>
        <ul style={{ marginTop: 16, paddingLeft: 18, lineHeight: 1.6, fontSize: 14 }}>
          <li>Setting up takes about a minute.</li>
          <li>You don&apos;t have to write anything first, or choose a type, or enter a date.</li>
          <li>Nothing is shared with anyone unless you decide to share it.</li>
        </ul>
        <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
          <Link
            to="/signup"
            search={{ redirect: "/live-recording" }}
            style={{
              display: "block",
              textAlign: "center",
              padding: "16px 20px",
              borderRadius: 3,
              background: "#1a1916",
              color: "#f4f1ea",
              textDecoration: "none",
            }}
          >
            Create a private account, then record
          </Link>
          <Link to="/signin" search={{ redirect: "/live-recording" }} style={{ textAlign: "center", fontSize: 14 }}>
            I already have an account
          </Link>
        </div>
        <p style={{ marginTop: 28, fontSize: 12, color: "var(--ink-muted, #5c574f)", lineHeight: 1.5 }}>
          Leaving this page does not erase your browsing history on this device. If someone else
          may check your device, use a private window.
        </p>
      </main>
    </div>
  );
}
