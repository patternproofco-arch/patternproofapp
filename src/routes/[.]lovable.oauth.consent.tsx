import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  component: ConsentPausedPage,
});

function ConsentPausedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md card-pp">
        <h1 className="font-serif text-xl mb-3">New app connections are paused</h1>
        <p className="text-sm mb-4">
          We are reviewing external app access and revocation controls. No new connection
          is approved on this page. You can still manage existing connections in settings.
        </p>
        <Link to="/settings" hash="connected-apps" className="btn-primary">Manage connected apps</Link>
      </div>
    </main>
  );
}
