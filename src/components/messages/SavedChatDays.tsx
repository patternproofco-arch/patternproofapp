import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getChatDayDigest } from "@/lib/chat-day-drafts.functions";
import type { DayDigest } from "@/lib/chat-export/digest";
import { ChatDayPicker } from "./ChatDayPicker";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; days: DayDigest[]; meName: string | null; undatedCount: number };

/**
 * The day-by-day view for a chat that was imported earlier, so a survivor can
 * come back and make drafts without re-adding the file. Counts and times only —
 * the message text is not loaded here.
 */
export function SavedChatDays({ threadId }: { threadId: string }) {
  const loadDigest = useServerFn(getChatDayDigest);
  // Keep the latest server-fn handle in a ref so the effect depends only on the thread.
  const loadRef = useRef(loadDigest);
  loadRef.current = loadDigest;
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadRef
      .current({ data: { threadId } })
      .then((r) => {
        if (!cancelled) {
          setState({
            status: "ready",
            days: r.days,
            meName: r.meName,
            undatedCount: r.undatedCount,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  if (state.status === "loading") {
    return (
      <p className="mt-3" style={{ fontSize: 13.5, color: "rgba(26,18,36,0.62)" }}>
        Loading the days in this chat…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="mt-3" style={{ fontSize: 13.5, color: "rgba(26,18,36,0.62)" }}>
        We couldn&apos;t load the days for this chat. Try again in a moment.
      </p>
    );
  }
  if (state.days.length === 0) {
    return (
      <p className="mt-3" style={{ fontSize: 13.5, color: "rgba(26,18,36,0.62)" }}>
        None of the messages in this chat have a date, so there are no days to pick.
      </p>
    );
  }
  return (
    <>
      {state.undatedCount > 0 && (
        <p className="mt-3" style={{ fontSize: 13, color: "rgba(26,18,36,0.62)" }}>
          {state.undatedCount.toLocaleString()} message{state.undatedCount === 1 ? "" : "s"} in this
          chat have no usable date and aren&apos;t listed by day.
        </p>
      )}
      <ChatDayPicker threadId={threadId} days={state.days} meName={state.meName} />
    </>
  );
}
