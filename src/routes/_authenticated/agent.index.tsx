import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { createAgentThread } from "@/lib/agent-threads.functions";

export const Route = createFileRoute("/_authenticated/agent/")({
  component: AgentIndex,
});

function AgentIndex() {
  const navigate = useNavigate();
  const createFn = useServerFn(createAgentThread);
  const started = useRef(false);
  // Was previously a silent, un-refreshable dead end on failure: `started`
  // reset on error, but a ref change doesn't re-run the effect, so nothing
  // ever retried and the user was left on "Opening a safe space…" forever
  // with no error and no way out. That's the worst failure mode for the
  // entry point to the survivor AI agent.
  const [status, setStatus] = useState<"loading" | "error">("loading");

  const start = () => {
    started.current = true;
    setStatus("loading");
    (async () => {
      const { thread } = await createFn({ data: {} });
      navigate({
        to: "/agent/$threadId",
        params: { threadId: (thread as { id: string }).id },
        replace: true,
      });
    })().catch(() => {
      started.current = false;
      setStatus("error");
    });
  };

  useEffect(() => {
    if (started.current) return;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "error") {
    return (
      <div className="card-pp flex h-full flex-col items-center justify-center gap-4 rounded-2xl p-10 text-center">
        <BrandMark size={52} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">We couldn't open a safe space.</p>
          <p className="text-sm text-muted-foreground">
            Nothing was sent. You can try again, or come back later.
          </p>
        </div>
        <button type="button" className="pp-btn-primary" onClick={start}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="card-pp flex h-full items-center justify-center rounded-2xl p-10">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <BrandMark size={52} />
        <p className="text-sm" aria-live="polite">
          Opening a safe space…
        </p>
      </div>
    </div>
  );
}
