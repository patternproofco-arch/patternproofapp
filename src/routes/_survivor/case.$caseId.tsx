import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, FileText, Mail, Phone, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_survivor/case/$caseId")({
  head: () => ({
    meta: [{ title: "Case — Survivor Portal" }],
  }),
  component: SurvivorCaseView,
});

interface Matter {
  id: string;
  matter_name: string;
  attorney_name: string;
  attorney_email: string;
  attorney_phone: string | null;
  created_at: string;
}

function SurvivorCaseView() {
  const { caseId } = useParams({ from: "/_survivor/case/$caseId" });
  const { user } = useAuth();
  const [matter, setMatter] = useState<Matter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("attorney_survivor_invites")
      .select("id,matter_name,attorney_name,attorney_email,attorney_phone,created_at")
      .eq("id", caseId)
      .eq("survivor_email", user.email)
      .eq("status", "accepted")
      .single()
      .then(({ data, error: err }) => {
        if (err) {
          setError("Case not found or access denied");
          console.error(err);
        } else if (data) {
          setMatter(data as Matter);
        }
        setLoading(false);
      });
  }, [caseId, user]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded w-32 animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error || !matter) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-foreground">{error || "Case not found"}</h3>
          <Link to="/survivor" className="text-sm text-primary hover:underline mt-2 inline-block">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Link
        to="/survivor"
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to home
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-foreground">{matter.matter_name}</h1>
        <p className="mt-2 text-muted-foreground">Your shared case information</p>
      </div>

      {/* Attorney Info */}
      <div className="rounded-lg border border-border bg-ground p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Your Attorney</h2>

        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Name</div>
            <div className="mt-1 text-foreground">{matter.attorney_name}</div>
          </div>

          {matter.attorney_email && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Email</div>
              <a
                href={`mailto:${matter.attorney_email}`}
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Mail className="h-4 w-4" />
                {matter.attorney_email}
              </a>
            </div>
          )}

          {matter.attorney_phone && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Phone</div>
              <a
                href={`tel:${matter.attorney_phone}`}
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Phone className="h-4 w-4" />
                {matter.attorney_phone}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/survivor/timeline"
          className="rounded-lg border border-border bg-ground p-4 hover:bg-muted/50 transition-colors text-center"
        >
          <FileText className="h-6 w-6 text-primary mx-auto mb-2" />
          <div className="font-medium text-foreground">View Timeline</div>
          <div className="text-xs text-muted-foreground">All your evidence organized</div>
        </Link>

        <Link
          to="/survivor/capture"
          className="rounded-lg border border-border bg-ground p-4 hover:bg-muted/50 transition-colors text-center"
        >
          <FileText className="h-6 w-6 text-primary mx-auto mb-2" />
          <div className="font-medium text-foreground">Add Evidence</div>
          <div className="text-xs text-muted-foreground">New photo or audio</div>
        </Link>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-2">How this works</p>
          <ul className="space-y-1 text-xs">
            <li>• Your attorney shared this case with you</li>
            <li>• You control what evidence you add and share</li>
            <li>• Everything is encrypted and private</li>
            <li>• Use the timeline to organize incidents and documents</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
