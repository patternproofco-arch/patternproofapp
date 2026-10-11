import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import {
  acknowledgeConnections,
  listUnseenConnections,
} from "@/lib/assistant-access.functions";

/**
 * Tells her when an outside app is connected that she hasn't been shown yet. The connection
 * itself can't be intercepted (it is approved on a page we don't control the server side of),
 * so this is how she finds out if someone connected one without her knowing.
 */
export function NewConnectionNotice() {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    listUnseenConnections()
      .then((apps) => {
        if (live) setNames(apps.map((a) => a.name));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (names.length === 0) return null;
  return (
    <div
      role="alert"
      className="mx-auto mt-3 flex w-full max-w-[430px] gap-3 px-4"
      style={{ color: "#3A3849" }}
    >
      <div
        className="flex w-full gap-3 p-3 text-[13px]"
        style={{ background: "rgba(197,103,74,0.08)", border: "1px solid rgba(197,103,74,0.25)" }}
      >
        <ShieldAlert size={18} color="var(--pp-urgent)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>
            {names.length === 1 ? "An app is connected" : `${names.length} apps are connected`}
          </strong>{" "}
          to your account: {names.slice(0, 3).join(", ")}
          {names.length > 3 ? " and more" : ""}. If you don't recognise {names.length === 1 ? "it" : "them"}, remove{" "}
          {names.length === 1 ? "it" : "them"} now.
          <div className="mt-2 flex gap-3">
            <Link
              to="/settings"
              hash="connected-apps"
              className="underline font-semibold"
              onClick={() => void acknowledgeConnections().catch(() => undefined)}
            >
              Review
            </Link>
            <button
              type="button"
              className="underline"
              onClick={() => {
                setNames([]);
                void acknowledgeConnections().catch(() => undefined);
              }}
            >
              I know about these
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
