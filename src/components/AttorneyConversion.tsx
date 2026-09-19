import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ATTORNEY_PLANS,
  ATTORNEY_PLAN_VALUE,
  ATTORNEY_FAQS,
  CLIENT_INVITATION_TEMPLATE,
} from "@/lib/attorney-offer";

export function AttorneyPlanComparison({ enabled = false }: { enabled?: boolean }) {
  return (
    <section aria-labelledby="attorney-plans-title" className="conversion-section">
      <p className="conversion-eyebrow">Transparent pricing</p>
      <h2 id="attorney-plans-title">Start with one case. Grow when you need to.</h2>
      <p>
        {enabled
          ? "One free case after attorney access review. No card required. Additional cases require a paid plan."
          : "Upcoming attorney plans. The first case offer and these prices are not open for activation yet. Explore the fictional sample and request the kit while access is being prepared."}
      </p>
      <div className="conversion-table-wrap">
        <table className="conversion-table">
          <caption>
            Monthly USD pricing. Case limits count active cases. Seats include the account owner.
          </caption>
          <thead>
            <tr>
              <th scope="col">Plan</th>
              <th scope="col">Per month</th>
              <th scope="col">Active cases</th>
              <th scope="col">Seats</th>
            </tr>
          </thead>
          <tbody>
            {ATTORNEY_PLANS.map((p) => (
              <tr key={p.key}>
                <th scope="row">
                  {p.name}
                  {p.approval && <small>Approval required</small>}
                </th>
                <td>${p.monthly}</td>
                <td>{p.cases}</td>
                <td>{p.seats}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="conversion-grid" style={{ marginTop: 28 }}>
        {ATTORNEY_PLANS.map((p) => (
          <article className="conversion-panel" key={p.key}>
            <h3>
              {p.name} · ${p.monthly}/month
            </h3>
            <p>{ATTORNEY_PLAN_VALUE[p.key]}</p>
          </article>
        ))}
      </div>
      <p>
        All listed plans include scoped chronology review, attorney notes, and authorized exports.
        Payment does not grant access to client records. Existing subscriptions keep their agreed
        terms. Enterprise and sponsored access require a separate agreement.
      </p>
      <p>
        <Link to="/lawyer-signup" className="conversion-button">
          {enabled ? "Start your first case free" : "Request attorney access"}
        </Link>
      </p>
      <p>
        Survivor documentation remains free. DV organizations remain referral partners at no cost.
      </p>
    </section>
  );
}

export function AttorneyTrustFaq({ full = false }: { full?: boolean }) {
  return (
    <section className="conversion-section" aria-labelledby="attorney-trust-title">
      <p className="conversion-eyebrow">Before you share</p>
      <h2 id="attorney-trust-title">Security and privacy, plainly explained.</h2>
      {(full ? ATTORNEY_FAQS : ATTORNEY_FAQS.slice(0, 4)).map((faq) => (
        <details className="conversion-faq" key={faq.q}>
          <summary>{faq.q}</summary>
          <p>{faq.a}</p>
        </details>
      ))}
      <p>
        <Link to="/security-privacy">Read all security and privacy questions</Link> ·{" "}
        <Link to="/privacy">Privacy Policy</Link>
      </p>
    </section>
  );
}

export function ClientInvitationTemplate() {
  const [notice, setNotice] = useState("");
  return (
    <section className="conversion-section" aria-labelledby="client-template-title">
      <h2 id="client-template-title">A gentle invitation you can personalize.</h2>
      <p>
        Use only after your access review is complete and the client agrees to this contact method.
        Replace the bracketed fields. Creating an account never grants automatic access.
      </p>
      <label htmlFor="client-invitation-template">Client invitation template</label>
      <textarea
        id="client-invitation-template"
        readOnly
        value={CLIENT_INVITATION_TEMPLATE}
        rows={12}
        className="conversion-template"
      />
      <button
        type="button"
        className="conversion-button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(CLIENT_INVITATION_TEMPLATE);
            setNotice("Copied. Replace the bracketed fields before sending.");
          } catch {
            setNotice("Select and copy the text above.");
          }
        }}
      >
        Copy invitation
      </button>
      <p role="status">{notice}</p>
    </section>
  );
}
