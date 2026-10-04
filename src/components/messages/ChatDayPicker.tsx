import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { countMessagesOnDays, describeDay, type DayDigest } from "@/lib/chat-export/digest";
import { createDraftsFromChatDays } from "@/lib/chat-day-drafts.functions";
import { createDraftsFromChatMessages } from "@/lib/chat-message-drafts.functions";

const MUTED = "rgba(26,18,36,0.62)";

interface Props {
  threadId: string;
  /** Day-by-day counts for the imported chat (counts and times only). */
  days: DayDigest[];
  /** The survivor's own name in the chat, used only to word "you". */
  meName: string | null;
  /** Optional block shown above the day list (e.g. photos found in a zip). */
  extra?: ReactNode;
}

/**
 * Pick days of an imported chat and turn them into soft drafts (one per message
 * or one per day). Used right after an import AND later from the saved chat, so
 * a survivor can come back without re-adding the file. Nothing reaches the
 * timeline until she approves a draft; it stays private until she shares it.
 */
export function ChatDayPicker({ threadId, days, meName, extra }: Props) {
  const makeDayDrafts = useServerFn(createDraftsFromChatDays);
  const makeMessageDrafts = useServerFn(createDraftsFromChatMessages);

  const [onlyOvernight, setOnlyOvernight] = useState(false);
  const [shown, setShown] = useState(60);
  const [pickedDays, setPickedDays] = useState<Set<string>>(new Set());
  const [drafting, setDrafting] = useState(false);
  const [draftsMade, setDraftsMade] = useState(0);
  /** one_per_message is the default; one_per_day is the shorter list. */
  const [draftMode, setDraftMode] = useState<"one_per_message" | "one_per_day">("one_per_message");

  const visibleDays = useMemo(
    () => (onlyOvernight ? days.filter((d) => d.overnight > 0) : days),
    [days, onlyOvernight],
  );
  const countSelectedMessages = useMemo(
    () => countMessagesOnDays(days, pickedDays),
    [days, pickedDays],
  );

  const toggleDay = (date: string) =>
    setPickedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  const draftSelected = async () => {
    if (pickedDays.size === 0) return;
    setDrafting(true);
    try {
      const picked = [...pickedDays].sort();
      let created = 0;
      let existing = 0;
      if (draftMode === "one_per_day") {
        for (let i = 0; i < picked.length; i += 100) {
          const r = await makeDayDrafts({ data: { threadId, days: picked.slice(i, i + 100) } });
          created += r.created;
          existing += r.skippedExisting;
        }
        setDraftsMade((n) => n + created);
        setPickedDays(new Set());
        toast(
          created > 0
            ? `${created} draft${created === 1 ? "" : "s"} added to Drafts to review (one per day). Nothing is on your timeline until you approve it.${existing ? ` ${existing} day${existing === 1 ? " was" : "s were"} already drafted.` : ""}`
            : "Those days already have drafts waiting.",
        );
      } else {
        // Per-message: chunk by day batches, then offset through long days.
        for (let i = 0; i < picked.length; i += 20) {
          const dayChunk = picked.slice(i, i + 20);
          let offset = 0;
          let guard = 0;
          while (guard < 200) {
            guard++;
            const r = await makeMessageDrafts({
              data: { threadId, days: dayChunk, offset, limit: 100 },
            });
            created += r.created;
            existing += r.skippedExisting;
            if (!r.hasMore) break;
            offset = r.nextOffset;
          }
        }
        setDraftsMade((n) => n + created);
        setPickedDays(new Set());
        toast(
          created > 0
            ? `${created} draft${created === 1 ? "" : "s"} added to Drafts to review (one per message). Nothing is on your timeline until you approve it.${existing ? ` ${existing} already had a draft.` : ""}`
            : "Those messages already have drafts waiting.",
        );
      }
    } catch {
      toast("We couldn't create those drafts. Try again in a moment.");
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="mt-5">
      <h3 className="font-serif" style={{ fontSize: 18 }}>
        Turn messages into drafts
      </h3>
      <p className="mt-1" style={{ fontSize: 13, color: MUTED }}>
        Counts and times only — exactly what the file says. Soft drafts only: nothing reaches your
        timeline until you approve it, and it stays private until you share.
      </p>
      <label className="mt-2 flex items-center gap-2" style={{ fontSize: 13.5 }}>
        <input
          type="checkbox"
          checked={onlyOvernight}
          onChange={(e) => {
            setOnlyOvernight(e.target.checked);
            setShown(60);
          }}
        />
        Only days with messages between midnight and 6 AM
      </label>
      <fieldset className="mt-3">
        <legend className="label-eyebrow">How should drafts be made?</legend>
        <div className="mt-2 space-y-1.5" style={{ fontSize: 13.5 }}>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name={`chat-draft-mode-${threadId}`}
              style={{ marginTop: 3 }}
              checked={draftMode === "one_per_message"}
              onChange={() => setDraftMode("one_per_message")}
            />
            <span>
              <strong>One draft per message</strong> — each message becomes its own draft with its
              transcript text so you can review and copy what you need.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name={`chat-draft-mode-${threadId}`}
              style={{ marginTop: 3 }}
              checked={draftMode === "one_per_day"}
              onChange={() => setDraftMode("one_per_day")}
            />
            <span>
              <strong>One draft per day</strong> — shorter list; quotes that day&apos;s messages
              together.
            </span>
          </label>
        </div>
      </fieldset>
      <p className="mt-3" style={{ fontSize: 13, color: MUTED }}>
        Tick the days you want to work with
        {draftMode === "one_per_message" && countSelectedMessages > 0
          ? ` (${countSelectedMessages.toLocaleString()} messages on selected days)`
          : ""}
        .
      </p>
      {extra}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="pp-btn-secondary"
          style={{ padding: "6px 12px" }}
          onClick={() => setPickedDays(new Set(visibleDays.map((d) => d.date)))}
        >
          Tick all {visibleDays.length} shown
        </button>
        <button
          type="button"
          className="pp-btn-secondary"
          style={{ padding: "6px 12px" }}
          disabled={pickedDays.size === 0}
          onClick={() => setPickedDays(new Set())}
        >
          Clear
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {visibleDays.slice(0, shown).map((d) => (
          <li key={d.date} style={{ fontSize: 13.5 }}>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                style={{ marginTop: 3 }}
                checked={pickedDays.has(d.date)}
                onChange={() => toggleDay(d.date)}
              />
              <span>
                <span className="mono-meta" style={{ marginRight: 8 }}>
                  {d.date}
                </span>
                {describeDay(d, meName)}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {visibleDays.length > shown && (
        <button
          type="button"
          className="pp-btn-secondary mt-3"
          style={{ padding: "8px 14px" }}
          onClick={() => setShown((n) => n + 60)}
        >
          Show more days ({visibleDays.length - shown} left)
        </button>
      )}
      <div
        className="mt-4 flex flex-wrap items-center gap-3"
        style={{ position: "sticky", bottom: 8 }}
      >
        <button
          type="button"
          className="btn-primary"
          disabled={pickedDays.size === 0 || drafting}
          onClick={draftSelected}
          style={{
            padding: "12px 18px",
            fontSize: 14.5,
            opacity: pickedDays.size === 0 || drafting ? 0.6 : 1,
          }}
        >
          {drafting
            ? "Creating drafts…"
            : pickedDays.size === 0
              ? "Tick days to make drafts"
              : draftMode === "one_per_message"
                ? `Make ${countSelectedMessages.toLocaleString()} message draft${countSelectedMessages === 1 ? "" : "s"} to review`
                : `Make ${pickedDays.size} day draft${pickedDays.size === 1 ? "" : "s"} to review`}
        </button>
        {draftsMade > 0 && (
          <Link to="/drafts" style={{ fontSize: 14, textDecoration: "underline" }}>
            Review {draftsMade} draft{draftsMade === 1 ? "" : "s"}
          </Link>
        )}
      </div>
    </div>
  );
}
