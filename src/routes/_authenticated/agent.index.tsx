import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { AppMark } from "@/components/brand/AppMark";
import { createAgentThread } from "@/lib/agent-threads.functions";

export const Route = createFileRoute("/_authenticated/agent/")({
  component: AgentIndex,
});

function AgentIndex() {
  const navigate = useNavigate();
  const createFn = useServerFn(createAgentThread);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const { thread } = await createFn({ data: {} });
      navigate({
        to: "/agent/$threadId",
        params: { threadId: (thread as { id: string }).id },
        replace: true,
      });
    })().catch(() => { started.current = false; });
  }, [createFn, navigate]);

  return (
    <div className="h-full rounded-[2px] flex items-center justify-center p-10 bg-card border border-border">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <AppMark size={52} />
        <p className="text-sm">Opening a safe space…</p>
      </div>
    </div>
  );
}