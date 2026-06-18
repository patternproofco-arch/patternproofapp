import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { Logo } from "@/components/Logo";
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
    <div
      className="h-full rounded-2xl flex items-center justify-center p-10"
      style={{ background: "#DEB896" }}
    >
      <div className="flex flex-col items-center gap-3 text-[#2A1A10]/80">
        <Logo variant="survivor" size={56} />
        <p className="text-sm">Opening a safe space…</p>
      </div>
    </div>
  );
}