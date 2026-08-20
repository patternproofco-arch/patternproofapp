import { Camera, ShieldCheck, Clock } from "lucide-react";

interface Props {
  participant: string;
  notes: string;
  onParticipant: (v: string) => void;
  onNotes: (v: string) => void;
  onPick: () => void;
  busy: boolean;
}

export function ImportIntro({ participant, notes, onParticipant, onNotes, onPick, busy }: Props) {
  return (
    <div className="card-pp" style={{ padding: 22 }}>
      <span className="exhibit-tag">MESSAGE IMPORT</span>
      <h2 className="mt-3 font-serif" style={{ fontSize: 24, lineHeight: 1.2 }}>
        Turn your screenshots into a <em>timeline you can search.</em>
      </h2>

      <p className="mt-3" style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(26,18,36,0.72)" }}>
        To be straightforward with you: PatternProof cannot open your phone&apos;s Messages app. No
        app can — iPhone and Android both keep that history closed to other apps. This works only
        from screenshots you choose to add here. Because of that, it works the same whether the
        conversation happened on an iPhone or an Android.
      </p>

      <p className="mt-2" style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(26,18,36,0.72)" }}>
        If the conversation is long, you can add a screen recording of yourself scrolling through it
        instead. We take still frames from it here on your device and read those the same way.
      </p>

      <ul className="mt-4 space-y-2" style={{ fontSize: 13.5, color: "rgba(26,18,36,0.72)" }}>
        <li className="flex gap-2">
          <ShieldCheck size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          Reading the text happens on your own device, in this browser. Nothing is sent to an AI.
        </li>
        <li className="flex gap-2">
          <Clock size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          Add them in any order. We&apos;ll put them in order for you, and save as we go.
        </li>
      </ul>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label-eyebrow" htmlFor="mi-participant">
            Who is this conversation with?
          </label>
          <input
            id="mi-participant"
            className="input-pp mt-1"
            value={participant}
            onChange={(e) => onParticipant(e.target.value)}
            placeholder="A name, a number, or however you think of them"
          />
        </div>
        <div>
          <label className="label-eyebrow" htmlFor="mi-notes">
            Anything you want to remember?
          </label>
          <input
            id="mi-notes"
            className="input-pp mt-1"
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="Optional — you never have to explain twice"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 sm:w-auto"
        style={{ padding: "16px 24px", fontSize: 15, minHeight: 52, opacity: busy ? 0.6 : 1 }}
      >
        <Camera size={18} /> Add screenshots or a recording
      </button>
      <p className="mt-2" style={{ fontSize: 12.5, color: "rgba(26,18,36,0.55)" }}>
        You can stop at any point and pick this back up later.
      </p>
    </div>
  );
}
