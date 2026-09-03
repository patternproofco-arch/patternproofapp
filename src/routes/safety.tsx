import { createFileRoute } from "@tanstack/react-router";
import { TrustPage, Section, Callout } from "@/components/pp/TrustPageShell";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Survivor Safety — PatternProof" },
      {
        name: "description",
        content:
          "How PatternProof reduces risk on shared devices, in shared accounts, and around abusive partners. What Quick Exit does, what it does not do, and safer-use practices.",
      },
      { property: "og:title", content: "Survivor Safety — PatternProof" },
      {
        property: "og:description",
        content:
          "Safer documentation on shared or monitored devices. Quick Exit limits, notification hygiene, and account recovery guidance.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/safety" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Survivor Safety — PatternProof" },
      {
        name: "twitter:description",
        content:
          "Safer documentation on shared or monitored devices. Quick Exit limits, notification hygiene, and account recovery guidance.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/safety" }],
  }),
  component: SafetyPage,
});

function SafetyPage() {
  return (
    <TrustPage
      title="Survivor Safety"
      subtitle="What PatternProof does — and does not do — to reduce risk."
    >
      <Section title="Quick Exit">
        <p>
          Quick Exit immediately replaces the visible page, stops visible media, and requires you to
          sign in again before returning. It is a fast way to change what is on screen if someone
          walks in.
        </p>
        <Callout>
          Quick Exit does not erase browser history, downloads, network records, or activity visible
          through a shared account. If you share a device or account with the person you are
          documenting, please read the safer-use notes below before continuing.
        </Callout>
      </Section>
      <Section title="Shared devices and accounts">
        <ul>
          <li>
            Use a device the other person cannot unlock. If that is not possible, sign out fully
            when you finish and clear recent files.
          </li>
          <li>Use a private browsing window when you cannot control history.</li>
          <li>
            Set your notifications to generic text. PatternProof will not send SMS by default and
            does not use sensitive email subjects.
          </li>
          <li>Consider a separate email address the other person does not know about.</li>
        </ul>
      </Section>
      <Section title="Notifications and previews">
        <p>
          App-switcher previews and lock-screen notifications can reveal content. Where your
          operating system supports it, hide previews for the browser and email apps you use with
          PatternProof.
        </p>
      </Section>
      <Section title="Account recovery">
        <p>
          Use a recovery method the other person does not control — a private email address, an
          authenticator app, or a passkey. Do not rely on SMS recovery to a phone number they may
          access.
        </p>
      </Section>
      <Section title="If you are in immediate danger">
        <p>
          PatternProof is a documentation tool. It is not an emergency service. If you are in
          immediate danger, contact local emergency services or a trained advocate.
        </p>
      </Section>
    </TrustPage>
  );
}
