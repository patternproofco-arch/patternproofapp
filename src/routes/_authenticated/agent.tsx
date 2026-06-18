import { createFileRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, MessageCircle, Trash2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  listAgentThreads,
  createAgentThread,
  deleteAgentThread,
} from "@/lib/agent-threads.functions";

export const Route = createFileRoute("/_authenticated/agent")({
  component: AgentLayout,
});

type Thread = { id: string; title: string; updated_at: string };

function AgentLayout() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const listFn = useServerFn(listAgentThreads);
  const createFn = useServerFn(createAgentThread);
  const deleteFn = useServerFn(deleteAgentThread);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    const { threads } = await listFn();
    setThreads(threads as Thread[]);
    setLoaded(true);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleNew = async () => {
    const { thread } = await createFn({ data: {} });
    await refresh();
    navigate({ to: "/agent/$threadId", params: { threadId: (thread as Thread).id } });
  };

  const handleDelete = async (id: string) => {
    await deleteFn({ data: { id } });
    if (params.threadId === id) navigate({ to: "/agent" });
    await refresh();
  };

  return (
    <div className="min-h-[calc(100vh-2rem)] grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 p-4">
      <aside
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{ background: "#DEB896", border: "1px solid rgba(78,59,49,0.12)" }}
      >
        <div className="flex items-center gap-2 px-1">
          <Logo variant="survivor" size={28} />
          <div className="font-serif italic text-[#2A1A10]">Agent</div>
        </div>
        <button
          onClick={handleNew}
          className="w-full rounded-xl px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          style={{ background: "#E77B56", color: "#FFF" }}
        >
          <Plus size={16} /> New conversation
        </button>
        <div className="text-[11px] uppercase tracking-wider text-[#4E3B31]/70 px-1 pt-1">Conversations</div>
        <nav className="flex-1 overflow-y-auto -mx-1">
          {!loaded && <div className="px-2 py-2 text-sm text-[#4E3B31]/70">Loading…</div>}
          {loaded && threads.length === 0 && (
            <div className="px-2 py-2 text-sm text-[#4E3B31]/70">
              Nothing here yet — when you're ready, start a new conversation.
            </div>
          )}
          {threads.map((t) => {
            const active = params.threadId === t.id;
            return (
              <div
                key={t.id}
                className="group flex items-center gap-1 mx-1 rounded-lg"
                style={{ background: active ? "rgba(106,146,214,0.18)" : "transparent" }}
              >
                <button
                  onClick={() => navigate({ to: "/agent/$threadId", params: { threadId: t.id } })}
                  className="flex-1 text-left px-2 py-2 text-sm text-[#2A1A10] truncate flex items-center gap-2"
                  title={t.title}
                >
                  <MessageCircle size={14} className="shrink-0 opacity-70" />
                  <span className="truncate">{t.title}</span>
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="px-2 py-2 text-[#4E3B31]/60 hover:text-[#E77B56] opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </nav>
        <p className="text-[11px] text-[#4E3B31]/70 px-1 leading-relaxed">
          Information only — not legal advice. If you're in immediate danger, call 911 or the
          National DV Hotline 1-800-799-7233.
        </p>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}