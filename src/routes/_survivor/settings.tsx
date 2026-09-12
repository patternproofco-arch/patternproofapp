import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_survivor/settings")({
  head: () => ({
    meta: [{ title: "Settings — Survivor Portal" }],
  }),
  component: SurvivorSettings,
});

function SurvivorSettings() {
  const { user } = useAuth();
  const [exitUrl, setExitUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const defaultExitUrl = "https://weather.com";

  useEffect(() => {
    // Load settings from localStorage
    try {
      const raw = localStorage.getItem("pp_settings_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        setExitUrl(parsed.exitUrl || defaultExitUrl);
      } else {
        setExitUrl(defaultExitUrl);
      }
    } catch (e) {
      setExitUrl(defaultExitUrl);
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = {
        exitUrl: exitUrl || defaultExitUrl,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem("pp_settings_v1", JSON.stringify(settings));
      setSaved(true);
      toast.success("Settings saved");

      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error("Failed to save settings");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your account and preferences.</p>
      </div>

      {/* Account Section */}
      <div className="rounded-lg border border-border bg-ground p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Account</h2>

        <div>
          <div className="text-sm font-medium text-muted-foreground">Email Address</div>
          <div className="mt-2 px-3 py-2 bg-muted rounded text-foreground text-sm">
            {user?.email}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Contact support to change your email address
          </p>
        </div>
      </div>

      {/* Quick Exit Section */}
      <div className="rounded-lg border border-border bg-ground p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Exit</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="exitUrl" className="block text-sm font-medium text-muted-foreground mb-2">
              Quick Exit URL
            </label>
            <input
              id="exitUrl"
              type="url"
              value={exitUrl}
              onChange={(e) => setExitUrl(e.target.value)}
              placeholder="https://weather.com"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-2">
              When you press Escape twice, this website will open immediately.
            </p>
          </div>

          {/* Testing Quick Exit */}
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              To test Quick Exit:
            </div>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Press Escape once</li>
              <li>Press Escape again within 500ms</li>
              <li>You'll be redirected to {exitUrl || defaultExitUrl}</li>
            </ol>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="pp-btn pp-btn-primary flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : null}
              {saving ? "Saving..." : saved ? "Saved" : "Save Settings"}
            </button>
          </div>
        </div>
      </div>

      {/* Privacy Section */}
      <div className="rounded-lg border border-border bg-ground p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Privacy & Security</h2>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">End-to-End Encryption</p>
            <p>All your evidence and messages are encrypted. Only you and your attorney can access them.</p>
          </div>

          <div>
            <p className="font-medium text-foreground mb-1">Data Control</p>
            <p>You control exactly what information you share with your attorney. You can revoke access at any time.</p>
          </div>

          <div>
            <p className="font-medium text-foreground mb-1">Browser Data</p>
            <p>This app stores minimal data in your browser. You can clear it anytime in your browser settings.</p>
          </div>
        </div>
      </div>

      {/* Support Section */}
      <div className="rounded-lg border border-border bg-ground p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Support</h2>

        <div className="space-y-3">
          <div>
            <p className="font-medium text-foreground text-sm mb-2">Need help?</p>
            <p className="text-sm text-muted-foreground mb-4">
              Contact PatternProof support or your attorney for assistance.
            </p>
            <a href="mailto:support@pattern-proof.tech" className="text-primary hover:underline text-sm">
              support@pattern-proof.tech
            </a>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Your Data is Safe</p>
          <p>PatternProof is designed specifically for survivors. Your privacy and security are our top priority.</p>
        </div>
      </div>
    </div>
  );
}
