import { createFileRoute } from "@tanstack/react-router";
import { Phone, Globe, MessageSquare, HeartHandshake } from "lucide-react";

export const Route = createFileRoute("/_authenticated/resources")({
  component: ResourcesPage,
});

interface Resource {
  name: string;
  desc: string;
  phone?: string;
  text?: string;
  url?: string;
}

const NATIONAL: Resource[] = [
  { name: "National Domestic Violence Hotline", desc: "24/7 confidential support, safety planning, local referrals.", phone: "1-800-799-7233", text: "Text START to 88788", url: "https://www.thehotline.org" },
  { name: "StrongHearts Native Helpline", desc: "Culturally appropriate support for Native survivors.", phone: "1-844-762-8483", url: "https://strongheartshelpline.org" },
  { name: "Love Is Respect (teen / young adult)", desc: "Help for dating abuse, healthy relationships.", phone: "1-866-331-9474", text: "Text LOVEIS to 22522", url: "https://www.loveisrespect.org" },
  { name: "RAINN Sexual Assault Hotline", desc: "24/7 confidential sexual assault support.", phone: "1-800-656-4673", url: "https://www.rainn.org" },
  { name: "988 Suicide & Crisis Lifeline", desc: "If you're in crisis or thinking about hurting yourself.", phone: "988", url: "https://988lifeline.org" },
];

const NJ: Resource[] = [
  { name: "NJ Coalition to End Domestic Violence", desc: "Statewide directory of NJ shelters and county programs.", phone: "1-800-572-7233", url: "https://njcedv.org" },
  { name: "NJ Family Court Self-Help", desc: "Forms and guidance for restraining orders and custody matters.", url: "https://www.njcourts.gov/self-help/domestic-violence" },
  { name: "Legal Services of New Jersey", desc: "Free civil legal help for low-income residents.", phone: "1-888-576-5529", url: "https://www.lsnjlaw.org" },
];

const SAFETY_TIPS = [
  "Keep a small bag with ID, cash, medication, and a phone charger somewhere accessible.",
  "Memorize the numbers of two people who would help you, in case your phone is taken.",
  "If leaving feels close, talk to a hotline advocate about a safety plan first — they do this every day.",
  "Your records here belong to you. Nothing is shared unless you choose to share it.",
];

function Card({ r }: { r: Resource }) {
  return (
    <div className="card-pp" style={{ borderLeft: "3px solid var(--accent)" }}>
      <h3 className="font-serif text-[17px] leading-tight">{r.name}</h3>
      <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>{r.desc}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {r.phone && (
          <a href={`tel:${r.phone.replace(/\D/g, "")}`} className="btn-primary inline-flex items-center gap-1 text-[13px]">
            <Phone size={13} /> {r.phone}
          </a>
        )}
        {r.text && (
          <span className="btn-ghost inline-flex items-center gap-1 text-[13px]">
            <MessageSquare size={13} /> {r.text}
          </span>
        )}
        {r.url && (
          <a href={r.url} target="_blank" rel="noreferrer" className="btn-ghost inline-flex items-center gap-1 text-[13px]">
            <Globe size={13} /> Visit
          </a>
        )}
      </div>
    </div>
  );
}

function ResourcesPage() {
  return (
    <div>
      <div className="label-eyebrow">Resources</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        You're not <em>alone in this.</em>
      </h1>
      <p className="mt-2 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Real people, on the other end of a phone, who do this every day. Call from a safe device when you can.
      </p>

      <h2 className="mt-8 font-serif text-[22px]">National</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {NATIONAL.map((r) => <Card key={r.name} r={r} />)}
      </div>

      <h2 className="mt-10 font-serif text-[22px]">New Jersey</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {NJ.map((r) => <Card key={r.name} r={r} />)}
      </div>

      <div className="card-pp mt-10" style={{ borderLeft: "3px solid var(--safe)" }}>
        <div className="flex items-center gap-2"><HeartHandshake size={18} style={{ color: "var(--safe)" }} /><h2 className="font-serif text-[19px]">Quiet safety reminders</h2></div>
        <ul className="mt-3 space-y-2 text-[14px]" style={{ color: "var(--foreground)" }}>
          {SAFETY_TIPS.map((t) => <li key={t}>• {t}</li>)}
        </ul>
      </div>
    </div>
  );
}