import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * Human-readable build marker. Reads the same /version.json the automated
 * checks read, plus the hosting deployment id from the response headers, so a
 * release check can be done by eye or by script against identical values.
 */
export const Route = createFileRoute("/version")({
  head: () => ({
    meta: [
      { title: "Build version — PatternProof" },
      {
        name: "description",
        content:
          "Commit, build time and deployment identifier for the PatternProof release currently serving this site.",
      },
      { property: "og:title", content: "Build version — PatternProof" },
      {
        property: "og:description",
        content: "Commit, build time and deployment identifier for the current release.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VersionPage,
});

type Info = {
  commit: string;
  commit_short: string;
  commit_source: string;
  build_id: string;
  built_at: string;
};

function VersionPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/version.json", { cache: "no-store" })
      .then(async (res) => {
        const id =
          res.headers.get("x-deployment-id") ??
          res.headers.get("cf-ray") ??
          res.headers.get("x-lovable-deployment-id");
        const body = (await res.json()) as Info;
        if (cancelled) return;
        setDeploymentId(id);
        setInfo(body);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pp-public-shell min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-[560px]">
        <h1 className="font-serif text-[26px] font-bold">Build version</h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          What&apos;s running on this address right now. Same values as{" "}
          <a href="/version.json" style={{ color: "var(--accent)" }}>
            /version.json
          </a>
          .
        </p>

        <div className="card-pp mt-6" style={{ display: "grid", gap: 10 }}>
          {failed && <Row label="Status" value="Couldn't read the build marker." />}
          {!failed && !info && <Row label="Status" value="Reading…" />}
          {info && (
            <>
              <Row label="Commit" value={info.commit} mono />
              <Row label="Short" value={info.commit_short} mono />
              <Row label="Commit source" value={info.commit_source} />
              <Row label="Build ID" value={info.build_id} mono />
              <Row
                label="Built at"
                value={`${info.built_at}${
                  Number.isNaN(Date.parse(info.built_at))
                    ? ""
                    : ` (${new Date(info.built_at).toLocaleString()})`
                }`}
              />
              <Row label="Deployment ID" value={deploymentId ?? "not reported by hosting"} mono />
              <Row label="Address" value={typeof window === "undefined" ? "" : window.location.host} />
            </>
          )}
        </div>

        <p className="mt-4 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          If the commit reads &quot;unknown&quot;, the build machine had no repository history — the
          build ID and build time still identify the release uniquely.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--muted-foreground)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          wordBreak: "break-all",
          fontFamily: mono ? "var(--font-mono, monospace)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
