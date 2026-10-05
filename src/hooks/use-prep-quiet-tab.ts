import { useCallback, useEffect, useRef, useState } from "react";
import {
  QUIET_TAB_FAVICON,
  QUIET_TAB_TITLE,
} from "@/lib/prep/constants";
import { getQuietTabEnabled, setQuietTabEnabled } from "@/lib/prep/session-county";

function findFaviconLink(): HTMLLinkElement | null {
  return (
    document.querySelector<HTMLLinkElement>('link[rel="icon"]') ||
    document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]')
  );
}

/**
 * Optional Quiet Tab disguise: title "Local Daily Weather & Forecast" + sun/cloud favicon.
 * Session-only preference. Soft claim: visual camouflage for glancing only; not forensic erasure.
 */
export function usePrepQuietTab() {
  const [enabled, setEnabled] = useState(false);
  const originalTitle = useRef<string | null>(null);
  const originalHref = useRef<string | null>(null);

  const apply = useCallback((on: boolean) => {
    if (typeof document === "undefined") return;
    const link = findFaviconLink();
    if (on) {
      if (originalTitle.current === null) originalTitle.current = document.title;
      if (link && originalHref.current === null) originalHref.current = link.href;
      document.title = QUIET_TAB_TITLE;
      if (link) link.href = QUIET_TAB_FAVICON;
    } else {
      if (originalTitle.current !== null) {
        document.title = originalTitle.current;
        originalTitle.current = null;
      }
      if (link && originalHref.current !== null) {
        link.href = originalHref.current;
        originalHref.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const on = getQuietTabEnabled();
    setEnabled(on);
    apply(on);
    return () => {
      // Restore real title/favicon when leaving prep routes.
      apply(false);
    };
  }, [apply]);

  const toggle = useCallback(
    (next: boolean) => {
      setQuietTabEnabled(next);
      setEnabled(next);
      apply(next);
    },
    [apply],
  );

  return { enabled, toggle, quietTitle: QUIET_TAB_TITLE };
}
