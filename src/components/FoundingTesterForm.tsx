import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { submitSupportRequest } from "@/lib/support.functions";
import { TESTER_ROLES, type TesterMode, type TesterRole } from "@/lib/founding-testers";

export function FoundingTesterForm({ mode, initialRole }: { mode: TesterMode; initialRole?: TesterRole }) {
  const send = useServerFn(submitSupportRequest);
  const pending = useRef(false);
  const [role, setRole] = useState<TesterRole | "">(initialRole ?? "");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const joining = mode === "join";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError(null);
    if (!role) {
      setError("Choose a role, or select Other / prefer not to say.");
      return;
    }
    if (!joining && message.trim().length < 10) {
      setError("Please describe what was confusing, missing, or not working in at least 10 characters.");
      return;
    }
    pending.current = true;
    setStatus("sending");
    try {
      const result = await send({ data: {
        replyEmail: email.trim(),
        category: joining ? "Founding tester request" : "Product feedback",
        message: [
          joining ? "Request to join the free founding test cohort." : "Founding tester product feedback.",
          `Role: ${TESTER_ROLES.find((option) => option.value === role)!.label}`,
          message.trim() || "No additional notes provided.",
        ].join("\n\n"),
      } });
      if (!result.ok) {
        setStatus("idle");
        setError("rateLimited" in result && result.rateLimited
          ? "Several messages have arrived from this connection. Please try again later. Your message is still here."
          : "Your message could not be saved. Please try again. Your message is still here.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("idle");
      setError("We could not confirm your submission. Please try again. Your message is still here.");
    } finally {
      pending.current = false;
    }
  }

  if (status === "sent") return (
    <div role="status" className="tester-card">
      <h2>{joining ? "Your request is saved." : "Your feedback is saved."}</h2>
      <p>{joining
        ? "The PatternProof team will review your request and contact the email you provided with next steps. This is a request, not an account or access approval."
        : "Thank you for telling us what needs work. The PatternProof team can reply to the email you provided if more detail would help."}</p>
      <Link to="/demo">Explore the free fictional demo</Link>
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="tester-card tester-form" aria-label={joining ? "Founding tester request" : "Product feedback"}>
      <h2>{joining ? "Request a place in the cohort" : "Tell us what needs work"}</h2>
      <label>
        Your role
        <select required value={role} onChange={(event) => setRole(event.target.value as TesterRole)}>
          <option value="">Choose a role</option>
          {TESTER_ROLES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label>
        Email where it is safe to contact you
        <input type="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} aria-describedby="tester-email-note" />
      </label>
      <p id="tester-email-note" className="tester-note">Use an address you are comfortable receiving PatternProof messages at. We use it to respond to this request or feedback. This form does not subscribe you to marketing emails.</p>
      <label>
        {joining ? "What would you like to test? (optional)" : "What was confusing, missing, or not working?"}
        <textarea rows={5} maxLength={3500} required={!joining} minLength={joining ? undefined : 10} value={message} onChange={(event) => setMessage(event.target.value)} aria-describedby="tester-content-note" />
      </label>
      <p id="tester-content-note" className="tester-note">Describe the product, not your case. Do not include names, case details, records, evidence, or passwords. Use fictional information while testing.</p>
      <label className="tester-consent">
        <input type="checkbox" required />
        <span>PatternProof may contact me at this email about my request or feedback.</span>
      </label>
      <p className="tester-note">Read our <Link to="/privacy">privacy information</Link>. Quick Exit leaves this site but does not clear your browser history.</p>
      {error && <p role="alert" className="tester-error">{error}</p>}
      <button type="submit" className="btn-primary" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : joining ? "Request free testing" : "Send feedback"}
      </button>
    </form>
  );
}
