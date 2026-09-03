import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileQuestion, Link2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";

export const Route = createFileRoute("/family-law-workload")({
  head: () => ({
    meta: [
      { title: "Family Law Evidence Intake Field Brief — PatternProof" },
      {
        name: "description",
        content:
          "A fictional, source-linked example of organizing family-law records while preserving uncertain dates and unresolved questions.",
      },
      { property: "og:title", content: "Family Law Evidence Intake Field Brief — PatternProof" },
      {
        property: "og:description",
        content:
          "Review a fictional before-and-after example of structured family-law record intake.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/family-law-workload" },
      { name: "twitter:title", content: "Family Law Evidence Intake Field Brief — PatternProof" },
      {
        name: "twitter:description",
        content: "A fictional example of source-linked, uncertainty-preserving record intake.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/family-law-workload" }],
  }),
  component: FamilyLawWorkload,
});

function FamilyLawWorkload() {
  return (
    <main className="min-h-screen px-5 py-10" data-persona="attorney">
      <PublicQuickExit />
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="PatternProof home">
            <BrandMark size={50} variant="attorney" />
          </Link>
          <span className="label-eyebrow">Field brief · fictional example</span>
        </header>

        <section className="py-14 md:py-20">
          <p className="label-eyebrow">Family law evidence intake</p>
          <h1 className="mt-4 max-w-4xl font-serif text-[40px] leading-tight md:text-[62px]">
            Preserve the source. Preserve uncertainty. Reduce the first sorting pass.
          </h1>
          <p
            className="mt-6 max-w-2xl text-[17px] leading-7"
            style={{ color: "var(--muted-foreground)" }}
          >
            PatternProof is designed to organize scattered client records into a structured
            chronology for professional review. It does not decide what a record proves, establish
            admissibility, or replace legal judgment.
          </p>
          <div
            className="mt-6 rounded-2xl p-4 text-[14px]"
            style={{ background: "var(--tint-blue)" }}
          >
            This page uses invented people, dates, and records for education. Please do not send
            case files or client information.
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2" aria-label="Fictional before and after">
          <article className="card-pp">
            <p className="label-eyebrow">Before</p>
            <h2 className="mt-2 font-serif text-[26px]">
              A folder that still needs interpretation
            </h2>
            <ul className="mt-5 space-y-4 text-[14px]">
              <Item
                icon={<FileQuestion size={18} />}
                text="Duplicate screenshots with unclear source context"
              />
              <Item
                icon={<FileQuestion size={18} />}
                text="A message marked March even though the exact day is unknown"
              />
              <Item
                icon={<FileQuestion size={18} />}
                text="A police record separated from the event it may support"
              />
            </ul>
          </article>
          <article className="card-pp">
            <p className="label-eyebrow">After</p>
            <h2 className="mt-2 font-serif text-[26px]">A reviewable, source-linked chronology</h2>
            <ul className="mt-5 space-y-4 text-[14px]">
              <Item
                icon={<CheckCircle2 size={18} />}
                text="Duplicates marked without deleting the originals"
              />
              <Item
                icon={<CheckCircle2 size={18} />}
                text="Date labeled approximate instead of silently guessed"
              />
              <Item
                icon={<Link2 size={18} />}
                text="Each event traceable to the selected original record"
              />
            </ul>
          </article>
        </section>

        <section className="card-pp my-8">
          <p className="label-eyebrow">One fictional event</p>
          <h2 className="mt-2 font-serif text-[25px]">School pickup communication</h2>
          <dl className="mt-5 grid gap-4 text-[14px] md:grid-cols-3">
            <Fact label="Date" value="Approximately March 2026" />
            <Fact label="Source" value="Original message export, item F03" />
            <Fact label="Review state" value="User confirmed wording; date unresolved" />
          </dl>
          <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border)" }}>
            <p className="font-semibold">Unresolved question</p>
            <p className="mt-1 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              Does the original device or another record establish the day? Until confirmed, the
              chronology keeps the date approximate.
            </p>
          </div>
        </section>

        <section className="my-12 text-center">
          <h2 className="font-serif text-[30px]">Review the complete two minute product example</h2>
          <p
            className="mx-auto mt-3 max-w-xl text-[14px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Continue with fictional material. No meeting and no client information required.
          </p>
          <Link to="/demo" className="btn-primary mt-6 inline-flex items-center gap-2">
            Review the fictional example <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </main>
  );
}

function Item({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      <span>{text}</span>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-eyebrow">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
