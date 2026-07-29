import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { correctMessageField } from "@/lib/message-import.functions";
import { MessageRow, type Correction, type ImportedMessage } from "./MessageRow";
import { ThreadFilters } from "./ThreadFilters";

export interface ImportThread {
  id: string;
  conversation_participant: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  threads: ImportThread[];
  initialThreadId?: string;
}

type Row = ImportedMessage & { thread_id: string };

export function ReviewThread({ userId, threads, initialThreadId }: Props) {
  const correct = useServerFn(correctMessageField);
  const [rows, setRows] = useState<Row[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [contactId, setContactId] = useState(initialThreadId ?? "all");
  const [loading, setLoading] = useState(true);

  const threadIds = useMemo(() => threads.map((t) => t.id), [threads]);

  const load = useCallback(async () => {
    if (threadIds.length === 0) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const [msgRes, docRes] = await Promise.all([
      supabase
        .from("thread_messages")
        .select("id,thread_id,body,sender_side,sent_on,sent_at_time,date_confidence,has_attachment_marker,attachment_marker_text,field_provenance,source_document_ids,source_document_id,position")
        .eq("user_id", userId)
        .in("thread_id", threadIds)
        .order("sent_on", { ascending: true, nullsFirst: false })
        .order("position", { ascending: true }),
      supabase
        .from("thread_source_documents")
        .select("id,storage_path")
        .eq("user_id", userId)
        .in("thread_id", threadIds),
    ]);
    const messages = (msgRes.data as unknown as Row[] | null) ?? [];
    setRows(messages);

    const ids = messages.map((m) => m.id);
    if (ids.length) {
      const { data: corr } = await supabase
        .from("thread_message_corrections")
        .select("id,message_id,field,old_value,new_value,created_at")
        .eq("user_id", userId)
        .in("message_id", ids)
        .order("created_at", { ascending: true });
      setCorrections((corr as Correction[] | null) ?? []);
    } else {
      setCorrections([]);
    }

    const map: Record<string, string> = {};
    await Promise.all(((docRes.data as Array<{ id: string; storage_path: string }> | null) ?? []).map(async (d) => {
      const { data: signed } = await supabase.storage.from("evidence-files").createSignedUrl(d.storage_path, 3600);
      if (signed?.signedUrl) map[d.id] = signed.signedUrl;
    }));
    setThumbs(map);
    setLoading(false);
  }, [threadIds, userId]);

  useEffect(() => { load(); }, [load]);

  const onCorrect = async (id: string, field: "body" | "sender_side" | "sent_on" | "sent_at_time", value: string | null) => {
    setRows((prev) => prev.map((r) => (r.id === id
      ? { ...r, [field]: value, field_provenance: { ...(r.field_provenance ?? {}), [field]: "corrected" } }
      : r)));
    try {
      await correct({ data: { messageId: id, field, value } });
      const { data: corr } = await supabase
        .from("thread_message_corrections")
        .select("id,message_id,field,old_value,new_value,created_at")
        .eq("user_id", userId)
        .eq("message_id", id)
        .order("created_at", { ascending: true });
      setCorrections((prev) => [...prev.filter((c) => c.message_id !== id), ...((corr as Correction[] | null) ?? [])]);
    } catch {
      toast("We couldn't save that change. Try again in a moment.");
      load();
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (contactId !== "all" && r.thread_id !== contactId) return false;
      if (from && (!r.sent_on || r.sent_on < from)) return false;
      if (to && (!r.sent_on || r.sent_on > to)) return false;
      if (q && !(r.body ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, from, to, contactId]);

  const contacts = threads.map((t) => ({
    id: t.id,
    label: t.conversation_participant || `Import from ${new Date(t.created_at).toLocaleDateString()}`,
  }));

  return (
    <div className="space-y-3">
      <ThreadFilters
        search={search} onSearch={setSearch}
        from={from} to={to} onFrom={setFrom} onTo={setTo}
        contacts={contacts} contactId={contactId} onContact={setContactId}
        count={filtered.length}
      />

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: 96, background: "rgba(20,19,31,0.05)", borderRadius: 2 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-pp">
          <p style={{ fontSize: 14, color: "rgba(20,19,31,0.65)" }}>
            {rows.length === 0
              ? "Nothing here yet — when you're ready, add a few screenshots and they'll appear as a thread."
              : "Nothing matches those filters right now."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              thumbUrls={(m.source_document_ids?.length ? m.source_document_ids : [m.source_document_id])
                .filter((v): v is string => !!v)
                .map((id) => thumbs[id])
                .filter((v): v is string => !!v)}
              corrections={corrections.filter((c) => c.message_id === m.id)}
              onCorrect={(field, value) => onCorrect(m.id, field, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}