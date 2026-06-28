import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — P4TTERN PR00F" },
      { name: "description", content: "How P4TTERN PR00F collects, uses, stores, and protects your information. Privacy-by-design documentation platform for survivors of domestic violence and coercive control." },
      { property: "og:title", content: "Privacy Policy — P4TTERN PR00F" },
      { property: "og:description", content: "Privacy-by-design protections for survivors. Read how P4TTERN PR00F handles your documentation, AI processing, and data sharing." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse 80% 60% at 15% 10%, rgba(196,176,232,0.18), transparent 60%), radial-gradient(ellipse 70% 50% at 90% 90%, rgba(158,216,208,0.18), transparent 60%), #FAFBFD",
        color: "#1F1A2E",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        padding: "32px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#6B5FA4",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
          <Link
            to="/pricing"
            style={{
              fontSize: 13,
              color: "#6B5FA4",
              textDecoration: "underline",
              fontWeight: 500,
            }}
          >
            Pricing
          </Link>
        </div>

        <header style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#7C5CC4", fontWeight: 700, marginBottom: 12 }}>
            P4TTERN PR00F
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "#1F1A2E" }}>
            Privacy Policy
          </h1>
          <p style={{ marginTop: 12, fontSize: 13, color: "#6B6478" }}>
            Effective Date: June 2026 &nbsp;|&nbsp; Last Updated: June 2026
          </p>
        </header>

        <Prose>
          <p>
            PatternProof, operating as P4TTERN PR00F ("P4TTERN PR00F," "we," "us," or "our"),
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
            P4TTERN PR00F is a documentation and pattern analysis platform built for survivors
            of domestic violence, coercive control, and post-separation abuse, and the
            attorneys and advocates who support them.
          </p>
          <ul>
            <li><strong>Company:</strong> PatternProof</li>
            <li><strong>Founder:</strong> Grace Burns</li>
            <li><strong>Contact:</strong> gracieburns200@gmail.com</li>
            <li><strong>Location:</strong> Philadelphia, PA, United States</li>
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
            If you connect P4TTERN PR00F to a third-party service such as Clio (legal practice
            management software), we may receive information from that service as authorized
            by you. We only request access to the data necessary for the integration to function.
          </p>

          <H2>3. How We Use Your Information</H2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve the Services</li>
            <li>Generate timelines, pattern analyses, and attorney-ready summaries from your documentation</li>
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
            P4TTERN PR00F uses AI to analyze documentation and identify patterns. AI processing
            occurs in real time and is used only to generate outputs for you or your authorized
            attorney. Your documentation content is not stored by third-party AI providers for
            training purposes. We use API-based AI services that process data transiently and
            do not retain it.
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
          <H3>With Third-Party Integrations (e.g., Clio)</H3>
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
            <li><strong>Lovable</strong> — application hosting and infrastructure</li>
            <li><strong>Supabase</strong> — database storage</li>
            <li><strong>Anthropic / OpenAI</strong> — AI pattern analysis (transient processing only, data not retained)</li>
            <li><strong>Stripe</strong> — payment processing</li>
          </ul>
          <H3>Legal Requirements</H3>
          <p>
            We may disclose information if required by law, court order, or to protect the
            safety of our users or others. We will notify you of any such request if legally
            permitted to do so.
          </p>

          <H2>6. Data Security</H2>
          <p>We take the security of your data seriously. Measures we have implemented include:</p>
          <ul>
            <li>HTTPS/TLS encryption for all data in transit</li>
            <li>Encryption of data at rest</li>
            <li>PIN-based and credential-based account protection</li>
            <li>Access controls limiting who can view your data</li>
            <li>Regular security monitoring and patching</li>
          </ul>
          <p>
            No system is 100% secure. If you believe your account has been compromised, contact
            us immediately at gracieburns200@gmail.com.
          </p>

          <H2>7. Your Rights &amp; Choices</H2>
          <H3>Access and Correction</H3>
          <p>You may access and update your account information at any time through the platform.</p>
          <H3>Deletion</H3>
          <p>
            You may request deletion of your account and all associated data at any time. We
            will fulfill deletion requests within 5 business days. To request deletion, contact
            gracieburns200@gmail.com with the subject line "Data Deletion Request."
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
            We retain your account and documentation data for as long as your account is active
            or as needed to provide the Services. If you delete your account, we will delete
            your data within 5 business days, except where retention is required by law.
          </p>

          <H2>9. Minimum Age Requirement</H2>
          <p>
            P4TTERN PR00F is intended for adults aged 18 and older. The platform is a legal
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
            P4TTERN PR00F<br />
            gracieburns200@gmail.com<br />
            Philadelphia, PA, United States
          </p>

          <p style={{ marginTop: 32, fontStyle: "italic", color: "#7C5CC4", textAlign: "center" }}>
            The proof is in the patterns.
          </p>
        </Prose>
      </div>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 15,
        lineHeight: 1.7,
        color: "#2B2640",
      }}
      className="pp-privacy-prose"
    >
      <style>{`
        .pp-privacy-prose p { margin: 0 0 16px; }
        .pp-privacy-prose ul { margin: 0 0 20px; padding-left: 22px; }
        .pp-privacy-prose li { margin-bottom: 6px; }
        .pp-privacy-prose strong { color: #1F1A2E; font-weight: 600; }
      `}</style>
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 20, fontWeight: 700, marginTop: 36, marginBottom: 14,
      color: "#3A2E6E", letterSpacing: "-0.01em",
      borderBottom: "1px solid rgba(124,92,196,0.18)", paddingBottom: 8,
    }}>
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 15, fontWeight: 600, marginTop: 20, marginBottom: 8,
      color: "#2F8D85",
    }}>
      {children}
    </h3>
  );
}