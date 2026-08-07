import { createFileRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, MessageCircle, Trash2, FolderLock, Clock3, Sparkles, FileText, LifeBuoy, Settings as SettingsIcon, Menu, X } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";
import {
  listAgentThreads,
  createAgentThread,
  deleteAgentThread,
} from "@/lib/agent-threads.functions";

export const Route = createFileRoute("/_authenticated/agent")({
  component: AgentLayout,
});

type Thread = { id: string; title: string; updated_at: string };

const NAV_LINKS: { to: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { to: "/evidence", label: "Evidence Vault", icon: FolderLock },
  { to: "/timeline", label: "Timeline", icon: Clock3 },
  { to: "/patterns", label: "Pattern Map", icon: Sparkles },
  { to: "/court-packet", label: "Court Packet", icon: FileText },
  { to: "/resources", label: "Safety Resources", icon: LifeBuoy },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function AgentLayout() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const listFn = useServerFn(listAgentThreads);
  const createFn = useServerFn(createAgentThread);
  const deleteFn = useServerFn(deleteAgentThread);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const refresh = async () => {
    const { threads } = await listFn();
    setThreads(threads as Thread[]);
    setLoaded(true);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleNew = async () => {
    const { thread } = await createFn({ data: {} });
    await refresh();
    setMobileOpen(false);
    navigate({ to: "/agent/$threadId", params: { threadId: (thread as Thread).id } });
  };

  const handleDelete = async (id: string) => {
    await deleteFn({ data: { id } });
    if (params.threadId === id) navigate({ to: "/agent" });
    await refresh();
  };

  const Sidebar = (
    <aside
      className="rounded-[2px] p-4 flex flex-col gap-3 h-full"
      style={{
        background: "#EAF7EF",
        border: "1px solid #D8F0E0",
        boxShadow: "none",
      }}
    >
      <div className="flex items-center gap-2 px-1">
        <BrandMark size={26} />
        <div className="font-semibold text-[15px]" style={{ color: "#1F2933" }}>PatternProof</div>
      </div>
      <button
        onClick={handleNew}
        className="w-full rounded-[2px] px-3 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-105"
        style={{ background: "#4E8C8A", color: "#FFFFFF", boxShadow: "none" }}
      >
        <Plus size={16} /> New case chat
      </button>

      <div className="text-[10px] uppercase tracking-[0.12em] font-semibold px-2 pt-2" style={{ color: "#667085" }}>
        Case chats
      </div>
      <nav className="flex-1 overflow-y-auto -mx-1 min-h-[80px]">
        {!loaded && <div className="px-2 py-2 text-sm" style={{ color: "#667085" }}>Loading…</div>}
        {loaded && threads.length === 0 && (
          <div className="px-2 py-2 text-sm leading-relaxed" style={{ color: "#667085" }}>
            Nothing here yet — when you're ready, start a new case chat.
          </div>
        )}
        {threads.map((t) => {
          const active = params.threadId === t.id;
          return (
            <div
              key={t.id}
              className="group flex items-center gap-1 mx-1 rounded-[2px] transition-colors"
              style={{ background: active ? "#D8F0E0" : "transparent" }}
            >
              <button
                onClick={() => { setMobileOpen(false); navigate({ to: "/agent/$threadId", params: { threadId: t.id } }); }}
                className="flex-1 text-left px-2 py-2 text-sm truncate flex items-center gap-2 hover:bg-white/40 rounded-[2px]"
                style={{ color: "#1F2933" }}
                title={t.title}
              >
                <MessageCircle size={14} className="shrink-0 opacity-60" />
                <span className="truncate">{t.title}</span>
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "#667085" }}
                aria-label="Delete case chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </nav>

      <div className="text-[10px] uppercase tracking-[0.12em] font-semibold px-2 pt-1" style={{ color: "#667085" }}>
        Workspace
      </div>
      <div className="flex flex-col gap-0.5">
        {NAV_LINKS.map(({ to, label, icon: Icon }) => {
          const active = currentPath === to;
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 mx-1 px-2 py-2 rounded-[2px] text-sm transition-colors hover:bg-white/50"
              style={{
                color: active ? "#1F2933" : "#3a4654",
                background: active ? "#D8F0E0" : "transparent",
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon size={15} className="opacity-70" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      <p className="text-[11px] px-2 pt-1 leading-relaxed" style={{ color: "#667085" }}>
        Information only — not legal advice. If you're in immediate danger, call 911 or the
        National DV Hotline 1-800-799-7233.
      </p>
    </aside>
  );

  return (
    <div
      className="min-h-[calc(100vh-2rem)] grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 p-4"
      style={{ background: "#FBFEFC" }}
    >
      {/* Desktop sidebar */}
      <div className="hidden md:block">{Sidebar}</div>

      {/* Mobile menu trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 rounded-[2px] p-2 shadow"
        style={{ background: "#EAF7EF", border: "1px solid #D8F0E0", color: "#1F2933" }}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative w-[88%] max-w-[320px] h-full p-3" style={{ background: "#FBFEFC" }}>
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-2 right-2 z-10 rounded-[2px] p-1.5"
              style={{ color: "#1F2933" }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <div className="h-full">{Sidebar}</div>
          </div>
        </div>
      )}

      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  );
}