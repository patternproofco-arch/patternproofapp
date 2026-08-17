interface OrgPilotNoticeProps {
  /** What this workflow will do, in plain language. */
  summary: string;
  /** The rules that already hold for it, so nothing here reads as a promise of access. */
  rules: string[];
}

/**
 * Honest empty state for a DV-org workflow that is designed but not yet
 * switched on. It never renders counts or sample records.
 */
export function OrgPilotNotice({ summary, rules }: OrgPilotNoticeProps) {
  return (
    <div className="orgx-empty" style={{ marginTop: 24 }}>
      <p style={{ margin: 0 }}>{summary}</p>
      <p className="orgx-muted" style={{ margin: "10px 0 0", fontSize: 13.5 }}>
        This is not available yet. Nothing is hidden behind it — there is no data here to show, and
        no organization has access to anything described below until a survivor approves it.
      </p>
      <ul className="orgx-muted" style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 13.5, display: "grid", gap: 5 }}>
        {rules.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </div>
  );
}
