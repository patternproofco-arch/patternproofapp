import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  LEAVE_A_DOT_LINK,
  LEAVE_A_DOT_PROJECT,
  LEAVE_A_DOT_SCRIPT_SRC,
  shouldLoadLeaveADot,
} from "@/lib/leaveadot-routes";

// Removing the script tag does not stop code that has already run. Once the widget has loaded in
// this page, the only way to be sure it is gone is a fresh page load.
let loadedInThisPage = false;

function removeLeaveADotFromDocument() {
  if (typeof document === "undefined") return;
  document
    .querySelectorAll('script[src*="leaveadot.com"]')
    .forEach((el) => el.remove());
  document
    .querySelectorAll(
      'iframe[src*="leaveadot.com"], [id*="leaveadot"], [id*="LeaveADot"], [class*="leaveadot"], [data-leaveadot]',
    )
    .forEach((el) => el.remove());
}

/**
 * Loads Leave a Dot only on public marketing paths. On authenticated or
 * private-record routes the script and any injected widget nodes are removed.
 */
export function LeaveADotLoader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const allowed = shouldLoadLeaveADot(pathname);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!allowed) {
      removeLeaveADotFromDocument();
      if (loadedInThisPage) {
        // Moving from a public page into sign-in or the app: reload so the third-party code is gone.
        loadedInThisPage = false;
        window.location.reload();
      }
      return;
    }

    if (document.querySelector(`script[src="${LEAVE_A_DOT_SCRIPT_SRC}"]`)) return;

    const script = document.createElement("script");
    script.src = LEAVE_A_DOT_SCRIPT_SRC;
    script.async = true;
    script.dataset.project = LEAVE_A_DOT_PROJECT;
    script.dataset.link = LEAVE_A_DOT_LINK;
    document.body.appendChild(script);
    loadedInThisPage = true;
  }, [allowed]);

  return null;
}
