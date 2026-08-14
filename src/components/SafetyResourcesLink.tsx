import { useState } from "react";
import { Link } from "@tanstack/react-router";

/**
 * Always-present, never-triggered resource link. Expands inline (no modal,
 * no interruption) and is never shown in response to a score or threshold.
 */
export function SafetyResourcesLink() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-[2px] px-3 py-2 text-[13px] font-semibold"
        style={{ background: "var(--input)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      >
        Talk to someone · Safety resources
      </button>
      {open && (
        <div className="mt-3 rounded-[2px] p-4 text-[13px] leading-relaxed" style={{ background: "var(--input)", border: "1px solid var(--border)" }}>
          <p>
            National Domestic Violence Hotline —{" "}
            <a href="tel:18007997233" style={{ textDecoration: "underline" }}>1-800-799-7233</a>
          </p>
          <p className="mt-2">
            <Link to="/resources" style={{ textDecoration: "underline" }}>Safety planning and local resources</Link>
          </p>
          <p className="mt-2">
            If you have an attorney connected, you can{" "}
            <Link to="/share-with-attorney" style={{ textDecoration: "underline" }}>reach them here</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
