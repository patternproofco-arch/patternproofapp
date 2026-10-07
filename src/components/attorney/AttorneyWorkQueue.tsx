import { Link } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export type WorkQueueChip =
  | "Pending invite"
  | "Unanswered ask"
  | "New since you looked"
  | "Active"
  | "Expiring soon"
  | "Access withdrawn";

export type WorkQueueCardModel = {
  id: string;
  /** Display name / short id — never invent a legal identity. */
  name: string;
  clientId?: string;
  chip: WorkQueueChip;
  /** Soft gaps only from known metadata — never invent. */
  softGaps?: string | null;
  askItem?: string | null;
};

const CHIP_STYLE: Record<WorkQueueChip, { bg: string; fg: string }> = {
  "Pending invite": { bg: "#EEF2F7", fg: "var(--att-text-2)" },
  "Unanswered ask": { bg: "#F5EDE3", fg: "var(--att-navy)" },
  "New since you looked": { bg: "#E8EEF8", fg: "var(--att-navy)" },
  Active: { bg: "#E6F2EA", fg: "#1F5B3A" },
  "Expiring soon": { bg: "#F8EBD6", fg: "#8A5A12" },
  "Access withdrawn": { bg: "#F0EEEE", fg: "var(--att-slate)" },
};

function copyAsk(item: string) {
  const text = `Hi — when you’re ready, could you share ${item}? You choose what to include, and you can change or withdraw anytime.`;
  void navigator.clipboard.writeText(text).then(
    () => toast("Ask copied — soft wording only."),
    () => toast("Couldn’t copy. Select and copy manually."),
  );
}

/**
 * `linkMode="demo"` is for the fictional /demo/attorney portal: no router links are
 * rendered, so a signed-out visitor can never be sent into the real attorney portal
 * (which requires sign-in, MFA, and a subscription). Clicks call `onOpenDemoClient`.
 */
export type WorkQueueLinkMode = "live" | "demo";

export function AttorneyWorkQueue({
  cards,
  linkMode = "live",
  onOpenDemoClient,
}: {
  cards: WorkQueueCardModel[];
  linkMode?: WorkQueueLinkMode;
  onOpenDemoClient?: (clientId: string, view: "binder" | "client") => void;
}) {
  if (!cards.length) return null;
  return (
    <div style={{ marginBottom: 24 }} data-testid="attorney-work-queue">
      <div className="att-eyebrow" style={{ marginBottom: 8 }}>
        Work queue
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {cards.map((c) => {
          const style = CHIP_STYLE[c.chip];
          return (
            <div
              key={c.id}
              className="att-card"
              data-testid="attorney-work-queue-card"
              data-chip={c.chip}
              style={{
                padding: "12px 14px",
                borderLeft: "3px solid var(--att-navy)",
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ minWidth: 160 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                <span
                  className="att-tag"
                  style={{
                    marginTop: 6,
                    background: style.bg,
                    color: style.fg,
                    fontSize: 11,
                  }}
                >
                  {c.chip}
                </span>
                {c.softGaps ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--att-text-2)" }}>
                    {c.softGaps}
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {c.clientId && linkMode === "demo" ? (
                  <>
                    <button
                      type="button"
                      className="att-btn-secondary"
                      style={{ fontSize: 12 }}
                      onClick={() => onOpenDemoClient?.(c.clientId as string, "binder")}
                    >
                      Open binder
                    </button>
                    <button
                      type="button"
                      className="att-btn-secondary"
                      style={{ fontSize: 12 }}
                      onClick={() => onOpenDemoClient?.(c.clientId as string, "client")}
                    >
                      Open
                    </button>
                  </>
                ) : c.clientId ? (
                  <>
                    <Link
                      to="/binder/$clientId"
                      params={{ clientId: c.clientId }}
                      className="att-btn-secondary"
                      style={{ fontSize: 12 }}
                    >
                      Open binder
                    </Link>
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: c.clientId }}
                      className="att-btn-secondary"
                      style={{ fontSize: 12 }}
                    >
                      Open
                    </Link>
                  </>
                ) : null}
                <button
                  type="button"
                  className="att-btn-secondary"
                  style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                  onClick={() => copyAsk(c.askItem?.trim() || "what we talked about")}
                >
                  <Copy size={12} /> Copy ask
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Build cards from known listMyClients + invite fields only — soft placeholders never invent activity. */
export function buildAttorneyWorkQueueCards(opts: {
  clients: Array<{
    link_id: string;
    client_user_id: string;
    incident_count: number;
    evidence_count: number;
    open_doc_requests: number;
    unread_messages: number;
    expires_at?: string | null;
    revoked_at?: string | null;
    status?: string | null;
  }>;
  invites: Array<{
    id: string;
    invite_token?: string;
    effective_status: string;
    survivor_email?: string | null;
  }>;
  /** localStorage map clientId → ISO last opened */
  lastOpenedByClient?: Record<string, string>;
  lastIncidentByClient?: Record<string, string | null>;
}): WorkQueueCardModel[] {
  const cards: WorkQueueCardModel[] = [];
  const now = Date.now();
  const soonMs = 7 * 24 * 60 * 60 * 1000;

  for (const inv of opts.invites) {
    if (inv.effective_status === "pending") {
      cards.push({
        id: `invite-${inv.id}`,
        name: inv.survivor_email?.trim() || "Pending invite",
        chip: "Pending invite",
        softGaps: null,
        askItem: "an invite acceptance when you’re ready",
      });
    }
  }

  for (const c of opts.clients) {
    const short = `Client ${c.client_user_id.slice(0, 8)}`;
    let chip: WorkQueueChip = "Active";
    if (c.revoked_at || c.status === "revoked") {
      chip = "Access withdrawn";
    } else if (c.expires_at) {
      const exp = Date.parse(c.expires_at);
      if (!Number.isNaN(exp) && exp <= now) chip = "Access withdrawn";
      else if (!Number.isNaN(exp) && exp - now <= soonMs) chip = "Expiring soon";
    }
    if (chip === "Active" && c.open_doc_requests > 0) chip = "Unanswered ask";
    if (chip === "Active") {
      const lastOpen = opts.lastOpenedByClient?.[c.client_user_id];
      const lastInc = opts.lastIncidentByClient?.[c.client_user_id];
      if (lastOpen && lastInc && Date.parse(lastInc) > Date.parse(lastOpen)) {
        chip = "New since you looked";
      } else if (!lastOpen && (c.unread_messages > 0 || c.open_doc_requests > 0)) {
        chip = "New since you looked";
      }
    }

    const gaps: string[] = [];
    if (c.incident_count > 0 && c.evidence_count === 0) {
      gaps.push("Shared: timeline notes · Not shared: files");
    } else if (c.incident_count === 0 && c.evidence_count === 0) {
      gaps.push("Nothing shared in binder yet");
    }

    cards.push({
      id: `client-${c.link_id}`,
      name: short,
      clientId: c.client_user_id,
      chip,
      softGaps: gaps[0] ?? null,
      askItem: c.evidence_count === 0 ? "files you’re ready to include" : "an update on the file",
    });
  }

  // Cap for density — Soft CLEAR light signals
  return cards.slice(0, 12);
}

/** Soft since-last-visit summary from known work-queue chips only — never invent counts. */
export function summarizeSinceLastVisit(cards: WorkQueueCardModel[]): {
  newSince: number;
  unanswered: number;
  expiring: number;
} {
  let newSince = 0;
  let unanswered = 0;
  let expiring = 0;
  for (const c of cards) {
    if (c.chip === "New since you looked") newSince += 1;
    else if (c.chip === "Unanswered ask") unanswered += 1;
    else if (c.chip === "Expiring soon") expiring += 1;
  }
  return { newSince, unanswered, expiring };
}
