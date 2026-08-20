import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — PatternProof" },
      { name: "description", content: "How PatternProof collects, uses, stores, and protects your information. Privacy-by-design documentation platform for survivors of domestic violence and coercive control." },
      { property: "og:title", content: "Privacy Policy — PatternProof" },
      { property: "og:description", content: "Privacy-by-design protections for survivors. Read how PatternProof handles your documentation, AI processing, and data sharing." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div data-persona="survivor" className="pp-legal-shell">
      <div className="pp-legal-sheet">
        <nav className="pp-legal-nav" aria-label="Legal document navigation">
          <Link
            to="/"
            className="pp-legal-link"
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
          <Link
            to="/pricing"
            className="pp-legal-link"
          >
            Pricing
          </Link>
        </nav>

        <header className="mb-9">
          <p className="pp-legal-kicker">PatternProof</p>
          <h1 className="pp-legal-title">Privacy Policy</h1>
          <p className="pp-legal-meta">Effective Date: June 2026 &nbsp;|&nbsp; Last Updated: August 2026</p>
        </header>

        <Prose>
          <p>
            PatternProof, operating as PatternProof ("PatternProof," "we," "us," or "our"),
            is committed to protecting the privacy and safety of our users. This Privacy Policy
            explains how we collect, use, store, and protect your information when you use our
            platform and associated services (collectively, the "Services").
          </p>
          <p>
            Given the sensitive nature of our platform — designed to support survivors of
            domestic violence, coercive control, and post-separation abuse — we apply
            privacy-by-design principles that exceed minimum legal requirements.
          </p>
          <p>By using our Services, you agree to the terms of this Privacy Policy.</p>

          <H2>1. Who We Are</H2>
          <p>
            PatternProof is a documentation and pattern analysis platform built for survivors
            of domestic violence, coercive control, and post-separation abuse, and the
            attorneys and advocates who support them.
          </p>
          <ul>
            <li><strong>Company:</strong> PatternProof</li>
            <li><strong>Founder:</strong> Grace Burns</li>
            <li><strong>Contact:</strong> gracieburns200@gmail.com</li>
            <li><strong>Location:</strong> New Jersey, United States</li>
          </ul>

          <H2>2. Information We Collect</H2>
          <H3>Information You Provide</H3>
          <ul>
            <li>Name and email address</li>
            <li>Account credentials (password or PIN)</li>
            <li>Incident documentation: dates, descriptions, locations, people involved</li>
            <li>Uploaded files: photos, videos, PDFs, documents, message exports, voice notes</li>
            <li>Communication logs and notes</li>
            <li>Any other information you choose to enter into the platform</li>
          </ul>
          <H3>Information Collected Automatically</H3>
          <ul>
            <li>Device type and operating system</li>
            <li>Browser type</li>
            <li>IP address</li>
            <li>Usage data (pages visited, features used, timestamps)</li>
            <li>Error and crash logs</li>
          </ul>
          <H3>Information From Third-Party Integrations</H3>
          <p>
            If you connect PatternProof to a third-party service (for example, legal practice
            management software), we may receive information from that service as authorized
            by you. We only request access to the data necessary for the integration to function.
          </p>

          <H2>3. How We Use Your Information</H2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve the Services</li>
            <li>Generate timelines, pattern groupings, and summaries for professional review from your documentation</li>
            <li>Authenticate your account and protect against unauthorized access</li>
            <li>Respond to support requests</li>
            <li>Send you product updates and important notices (you may opt out at any time)</li>
            <li>Comply with legal obligations</li>
            <li>Detect and prevent fraud or abuse of the platform</li>
          </ul>
          <p>
            We do not sell your personal information. We do not use your documentation content
            to train AI models.
          </p>

          <H2>4. AI Processing</H2>
          <p>
            PatternProof uses AI to group and summarize your documentation. AI outputs — pattern
            analyses, summaries, and voice-note or recording transcripts — are stored by
            PatternProof in our database as part of your case record, and are retained on the same
            terms as the rest of your documentation (see Section 8). They are visible to you and to
            anyone you choose to share them with.
          </p>
          <p>
            What is not retained is the raw inference call at the third-party model provider: the
            content sent for a given request is processed to return that result and is not used to
            train their models. We do not independently control those providers' internal handling
            or retention beyond the terms of the gateway agreement described in Section 5.
          </p>

          <H2>5. How We Share Your Information</H2>
          <p>
            We do not sell, rent, or share your personal information with third parties for
            their marketing purposes. We may share information in the following limited circumstances:
          </p>
          <H3>With Your Authorized Attorney</H3>
          <p>
            If you choose to share your case file or export materials to an attorney through
            the platform, that attorney will receive the information you designate. You control
            what is shared.
          </p>
          <H3>With Third-Party Integrations</H3>
          <p>
            If you authorize integration with a third-party legal platform, we will share only
            the information necessary for that integration to function, as directed by you.
          </p>
          <H3>Service Providers</H3>
          <p>
            We work with trusted third-party service providers who help us operate the platform,
            including hosting, database, and AI processing providers. These providers are bound
            by terms that restrict use of your data to providing services to us. Current
            sub-processors include:
          </p>
          <ul>
            <li><strong>Lovable</strong> — application hosting, infrastructure, and AI Gateway (routes AI requests to underlying model providers)</li>
            <li><strong>Google (Gemini models)</strong> — AI pattern analysis and voice note transcription, via Lovable's AI Gateway. Processed per-request; PatternProof does not control Google's retention terms independently of Lovable's gateway agreement.</li>
            <li><strong>Supabase</strong> — database and file storage</li>
            <li><strong>Google Calendar / Google Drive</strong> — only if you choose to connect these integrations. Used to sync court dates or import files you select. Disconnect anytime; we stop syncing immediately.</li>
            <li><strong>Stripe</strong> — payment processing</li>
          </ul>
          <H3>Legal Requirements</H3>
          <p>
            We may disclose information if required by law, court order, or to protect the
            safety of our users or others. We will notify you of any such request if legally
            permitted to do so.
          </p>

          <H3>AI providers and subprocessors</H3>
          <p>
            Several features rely on third-party AI providers reached through the Lovable AI
            Gateway: Google (Gemini models) and OpenAI (GPT-4o transcription). Features that use
            them include Recurline pattern grouping, the Co-Pilot assistant, evidence content-type
            suggestions, and voice/recording transcription.
          </p>
          <p>
            When you use those features, the content involved — your entry text, message text,
            file names and extracted text, or audio — is transmitted to and processed by those
            providers. PatternProof does not independently contract with Google or OpenAI;
            processing is governed by Lovable's agreements with those providers and by each
            provider's own published API terms, which are the authoritative source for how that
            content is retained and handled. Their own published policies are the authoritative source
            (<a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Google</a>{" "}
            and <a href="https://openai.com/policies/" target="_blank" rel="noreferrer">OpenAI</a>).
            If you would prefer not to have content processed this way, avoid the AI features
            listed above; the rest of PatternProof works without them.
          </p>

          <H2>5.5 Connecting Third-Party AI Tools (MCP)</H2>
          <p>
            You may optionally connect an external AI assistant or client application to your
            PatternProof account using OAuth (the Model Context Protocol, or MCP). This is entirely
            your choice — nothing is connected unless you approve it on the consent screen.
          </p>
          <p>
            A connected app acts as you. With your approval it can read your documented incidents
            and evidence records, search your case, and log new incidents on your behalf. Access is
            scoped strictly to your own data — a connected app can never see another user's records,
            and it cannot see anything you could not see yourself.
          </p>
          <p>
            Once connected, the external app and its provider handle the data they retrieve under
            their own privacy terms, which we do not control. You can review your connected apps and
            revoke access at any time from Settings → Connected apps. Revoking takes effect
            immediately for new requests.
          </p>

          <H2>6. Data Security</H2>
          <p>We take the security of your data seriously. Measures we have implemented include:</p>
          <ul>
            <li>HTTPS/TLS encryption for all data in transit</li>
            <li>At-rest encryption is provided by our infrastructure hosts (managed Postgres and object storage) as a platform feature. We rely on their published controls and have not independently audited or certified that configuration.</li>
            <li>Row-level security policies scoping data access to the owning account</li>
            <li>Optional client-side screen lock (PIN or biometric) on your device</li>
            <li>Regular security monitoring, dependency patching, and access review</li>
          </ul>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            <strong>What we do not currently offer:</strong> end-to-end (zero-knowledge) encryption
            where PatternProof staff cannot technically read your data. We will clearly announce this
            capability if and when we ship it. Until then, please assume authorized PatternProof
            engineers can technically access account contents in order to operate and support the
            service.
          </p>
          <p>
            No system is 100% secure. If you believe your account has been compromised, contact
            us immediately at gracieburns200@gmail.com.
          </p>

          <H2>7. Your Rights &amp; Choices</H2>
          <H3>Access and Correction</H3>
          <p>You may access and update your account information at any time through the platform.</p>
          <H3>Deletion</H3>
          <p>
            Automated in-app account deletion is not yet available. To request
            deletion of your account and associated data, email
            gracieburns200@gmail.com with the subject line "Data Deletion Request."
            We aim to process requests within a reasonable time and will confirm
            when the deletion is complete. Until we can offer an automated
            deletion flow, this manual request process is the only supported
            method.
          </p>
          <H3>Data Export</H3>
          <p>
            You can export your documentation at any time using the platform's built-in export
            feature. Your data belongs to you.
          </p>
          <H3>California Residents (CCPA)</H3>
          <p>
            California residents have the right to know what personal information we collect,
            request deletion of their data, and opt out of the sale of personal information. We
            do not sell personal information. To exercise your rights, contact
            gracieburns200@gmail.com.
          </p>
          <H3>Opt Out of Communications</H3>
          <p>
            You may opt out of non-essential communications at any time by contacting us or
            using the unsubscribe link in any email.
          </p>

          <H2>8. Data Retention</H2>
          <p>
            We retain your account and documentation data for as long as your
            account is active or as needed to provide the Services. When you
            email us a deletion request (see "Deletion" above), we will remove
            your data as promptly as our current manual process allows, except
            where retention is required by law.
          </p>

          <H2>9. Minimum Age Requirement</H2>
          <p>
            PatternProof is intended for adults aged 18 and older. The platform is a legal
            documentation tool designed to support adult survivors navigating family court,
            custody, and domestic violence proceedings. We do not knowingly collect personal
            information from anyone under the age of 18. If we learn we have collected
            information from a minor, we will delete it immediately. If you believe we may have
            inadvertently collected information from someone under 18, please contact us at
            gracieburns200@gmail.com.
          </p>

          <H2>10. Third-Party Links</H2>
          <p>
            Our Services may contain links to third-party websites or services. We are not
            responsible for the privacy practices of those third parties and encourage you to
            review their privacy policies.
          </p>

          <H2>11. Changes to This Policy</H2>
          <p>
            We may update this Privacy Policy from time to time. When we do, we will update the
            "Last Updated" date at the top of this page and notify active users by email for
            material changes. Continued use of the Services after any update constitutes your
            acceptance of the updated Policy.
          </p>

          <H2>12. Contact Us</H2>
          <p>
            Grace Burns, Founder<br />
            PatternProof<br />
            gracieburns200@gmail.com<br />
            Philadelphia, PA, United States
          </p>

          <p className="pp-legal-signoff">The truth is in the pattern.</p>
        </Prose>
      </div>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="pp-legal-prose">
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2>{children}</h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3>{children}</h3>
  );
}