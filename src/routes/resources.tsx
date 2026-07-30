import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone, Globe, MessageSquare } from "lucide-react";
import { SettingsProvider, useSettings } from "@/lib/settings-context";
import { QuickExitButton } from "@/components/QuickExitButton";
import { BottomTabBar } from "@/components/BottomTabBar";
import { HubTabs, RESOURCE_TABS } from "@/components/HubTabs";
import { useAuth } from "@/lib/auth-context";
import { MicroMark } from "@/components/brand/MicroMark";
import { US_STATES, STATE_RESOURCES, type StateResource } from "@/lib/state-resources";

const INK = "#14131F";
const PAPER = "#F7F5F0";
const RULE = "rgba(20,19,31,0.14)";
const MUTED = "#8A8894";
const SERIF = "'Newsreader', Georgia, serif";
const SANS = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources — hotlines, state coalitions, court guidance | PatternProof" },
      { name: "description", content: "National hotlines, state domestic violence coalitions, and plain-language court guidance. Free, always available, nothing stored." },
      { property: "og:title", content: "Resources — PatternProof" },
      { property: "og:description", content: "National hotlines, state DV coalitions, and plain-language court guidance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResourcesRoute,
});

const NATIONAL: StateResource[] = [
  { name: "National Domestic Violence Hotline", url: "https://www.thehotline.org", phone: "1-800-799-7233" },
  { name: "StrongHearts Native Helpline", url: "https://strongheartshelpline.org", phone: "1-844-762-8483" },
  { name: "National Sexual Assault Hotline (RAINN)", url: "https://www.rainn.org", phone: "1-800-656-4673" },
  { name: "988 Suicide & Crisis Lifeline", url: "https://988lifeline.org", phone: "988" },
];

const GUIDANCE: { title: string; body: string; to?: string; label?: string }[] = [
  {
    title: "How courts read a record",
    body: "A dated, consistent record of small things usually carries further than one dramatic account. Write what happened, not how you feel about the person.",
    to: "/how-it-works",
    label: "See how it works",
  },
  {
    title: "Going without a lawyer",
    body: "Most people in family court are on their own. The self-help guide walks through filing, hearings, and what to bring, in plain language.",
    to: "/self-help-guide",
    label: "Open the self-help guide",
  },
  {
    title: "Staying safe while you document",
    body: "Use a device only you open, keep Quick Exit within reach, and know that nothing here is shared until you choose to share it.",
    to: "/safety",
    label: "Read safety notes",
  },
  {
    title: "Records requests",
    body: "Ask police departments, schools, or agencies for the records they already hold about your situation, with wording that gets a real answer.",
    to: "/opra-helper",
    label: "Open the records-request helper",
  },
  {
    title: "How the courts work",
    body: "Which court hears which case, what judges look for, and how a record is usually read.",
    to: "/court-systems",
    label: "Open the court systems guide",
  },
  {
    title: "Something not working?",
    body: "Reach a real person without going through your own email client.",
    to: "/support",
    label: "Contact support",
  },
];

function ResourcesRoute() {
  return (
    <SettingsProvider>
      <ResourcesPage />
    </SettingsProvider>
  );
}

function ResourcesPage() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [picked, setPicked] = useState("");
  const [ready, setReady] = useState(false);

  // settings hydrate from localStorage after mount
  useEffect(() => setReady(true), []);

  const activeState = settings.state || picked;
  const stateList = activeState ? STATE_RESOURCES[activeState] ?? [] : [];

  return (
    <div style={{ background: PAPER, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      <QuickExitButton />
      {user ? <BottomTabBar /> : null}

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(40px,8vw,88px) 24px 140px" }}>
        {user ? <HubTabs tabs={RESOURCE_TABS} /> : null}
        <Link to="/" style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: INK, textDecoration: "none" }}>
          ← PatternProof
        </Link>

        <div className="mono-meta mono-meta--muted" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED, marginTop: 32 }}>
          Resources
        </div>

        <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(2rem,5vw,3.2rem)", lineHeight: 1.12, letterSpacing: "-0.02em", margin: "12px 0 0" }}>
          Real people, on the other end of a phone.
        </h1>
        <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6, color: "#3A3849", maxWidth: 580 }}>
          Free and confidential. Call from a device the other person can't check when you can.
        </p>

        <Section title="If you are in danger right now">
          <div style={cardStyle}>
            <div style={{ fontFamily: SERIF, fontSize: 19 }}>Call 911</div>
            <p style={bodyStyle}>
              If someone is hurting you or you're afraid they're about to, call 911. If speaking isn't safe,
              many areas accept a text to 911 — and staying on an open line still sends help.
            </p>
          </div>
        </Section>

        <Section title="National">
          <div style={{ display: "grid", gap: 12 }}>
            <div style={cardStyle}>
              <div style={{ fontFamily: SERIF, fontSize: 19 }}>National Domestic Violence Hotline</div>
              <p style={bodyStyle}>24/7 confidential support, safety planning, and local referrals.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                <a href="tel:18007997233" style={linkStyle}><Phone size={13} /> 1-800-799-7233</a>
                <span style={{ ...linkStyle, borderColor: "transparent", color: MUTED }}><MessageSquare size={13} /> Text START to 88788</span>
                <a href="https://www.thehotline.org" target="_blank" rel="noreferrer" style={linkStyle}><Globe size={13} /> thehotline.org</a>
              </div>
            </div>
            {NATIONAL.slice(1).map((r) => <ResourceCard key={r.name} r={r} />)}
          </div>
        </Section>

        <Section title="In your state">
          {ready && stateList.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {stateList.map((r) => <ResourceCard key={r.name} r={r} />)}
              <p style={{ ...bodyStyle, color: MUTED }}>
                State coalitions keep the directory of local shelters, advocates, and court-help programs.
              </p>
            </div>
          ) : (
            <div style={cardStyle}>
              <p style={{ ...bodyStyle, marginTop: 0 }}>
                Pick a state to see its coalition. Nothing is saved unless you set it in your own settings.
              </p>
              <select
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
                style={{
                  marginTop: 12,
                  width: "100%",
                  maxWidth: 320,
                  padding: "10px 12px",
                  border: `1px solid ${RULE}`,
                  borderRadius: 2,
                  background: "#FFFFFF",
                  color: INK,
                  fontFamily: SANS,
                  fontSize: 15,
                }}
              >
                <option value="">Choose a state</option>
                {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
          )}
        </Section>

        <Section title="Court & legal guidance">
          <div style={{ display: "grid", gap: 12 }}>
            {GUIDANCE.map((g) => (
              <div key={g.title} style={cardStyle}>
                <div style={{ fontFamily: SERIF, fontSize: 19 }}>{g.title}</div>
                <p style={bodyStyle}>{g.body}</p>
                {g.to ? (
                  <Link to={g.to} style={{ ...linkStyle, marginTop: 12, display: "inline-flex" }}>{g.label} →</Link>
                ) : null}
              </div>
            ))}
          </div>
        </Section>

        <div style={{ marginTop: 56, paddingTop: 20, borderTop: `1px solid ${RULE}`, color: MUTED, fontSize: 13 }}>
          <MicroMark size={22} />
          <div style={{ marginTop: 10 }}>
            PatternProof is not a crisis service and not a law firm.
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: `1px solid ${RULE}`,
  borderRadius: 2,
  padding: 20,
};

const bodyStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 15,
  lineHeight: 1.6,
  color: "#3A3849",
};

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: `1px solid ${RULE}`,
  borderRadius: 2,
  padding: "6px 10px",
  fontFamily: MONO,
  fontSize: 12,
  letterSpacing: "0.06em",
  color: INK,
  textDecoration: "none",
};

function ResourceCard({ r }: { r: StateResource }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontFamily: SERIF, fontSize: 19 }}>{r.name}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
        {r.phone ? (
          <a href={`tel:${r.phone.replace(/\D/g, "")}`} style={linkStyle}><Phone size={13} /> {r.phone}</a>
        ) : null}
        <a href={r.url} target="_blank" rel="noreferrer" style={linkStyle}>
          <Globe size={13} /> {r.url.replace(/^https?:\/\//, "")}
        </a>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 48 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED, paddingBottom: 10, borderBottom: `1px solid ${RULE}`, marginBottom: 16 }}>
        {title}
      </div>
      {children}
    </section>
  );
}
