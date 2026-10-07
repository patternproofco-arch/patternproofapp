// @vitest-environment jsdom
/**
 * Renders the fictional demo portals with a router-Link stub that emits <a href>,
 * then checks: no link into a signed-in portal, the read-only banner is present,
 * save/export/share controls are toast-only, practice text lives in memory only and
 * is cleared on Quick Exit / unmount, and nothing touches network or storage.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastInfo = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { info: toastInfo }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children, search: _s, ...rest }: any) => {
    let href = String(to);
    for (const [k, v] of Object.entries(params ?? {})) href = href.replace(`$${k}`, String(v));
    return (
      <a href={href} data-to={String(to)} {...rest}>
        {children}
      </a>
    );
  },
}));

import { AttorneyWorkQueue } from "@/components/attorney/AttorneyWorkQueue";
import { DemoAttorneyPortal } from "@/components/demo/DemoAttorneyPortal";
import { DemoOrgPortal } from "@/components/demo/DemoOrgPortal";
import { DemoPortalShell } from "@/components/demo/DemoPortalShell";
import { DemoPrepPortal } from "@/components/demo/DemoPrepPortal";
import { DemoPrepPractice } from "@/components/demo/DemoPrepPractice";
import { DEMO_WORK_QUEUE } from "@/lib/demo/fixtures-attorney";
import { DEMO_PRACTICE_NOTICE } from "@/lib/demo/fixtures-prep";

const BANNED_HREF =
  /^\/(binder|clients|caseload|prep|org-portal|advocate-|attorney\/|review\/|dashboard|setup|matters|team|billing)/;
/** Public pages a demo may link to. */
const ALLOWED_HREF = /^\/(demo(\/(attorney|org|prep))?|founding-testers|signup|pricing)?$/;

let root: Root;
let host: HTMLDivElement;
const fetchSpy = vi.fn();
const setItemSpy = vi.fn();
const getItemSpy = vi.fn();
const beaconSpy = vi.fn();

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  toastInfo.mockClear();
  fetchSpy.mockClear();
  setItemSpy.mockClear();
  getItemSpy.mockClear();
  beaconSpy.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(setItemSpy);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(getItemSpy);
  Object.defineProperty(navigator, "sendBeacon", { value: beaconSpy, configurable: true });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  vi.spyOn(window, "print").mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function render(node: React.ReactNode) {
  await act(async () => {
    root.render(node);
  });
}

function hrefs(): string[] {
  return [...host.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
}

function expectNoLiveTraffic() {
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(setItemSpy).not.toHaveBeenCalled();
  expect(getItemSpy).not.toHaveBeenCalled();
  expect(beaconSpy).not.toHaveBeenCalled();
}

async function clickAll(selector = "button") {
  for (const b of [...host.querySelectorAll<HTMLButtonElement>(selector)]) {
    if (b.closest("[data-quick-exit]")) continue;
    await act(async () => {
      b.click();
    });
  }
}

describe("AttorneyWorkQueue link modes", () => {
  it("live mode still links to the signed-in binder and client pages", async () => {
    await render(<AttorneyWorkQueue cards={DEMO_WORK_QUEUE} />);
    expect(hrefs()).toContain("/binder/demo-client-rm");
    expect(hrefs()).toContain("/clients/demo-client-rm");
  });

  it("demo mode renders no links at all and opens clients in-page", async () => {
    const onOpen = vi.fn();
    await render(
      <AttorneyWorkQueue cards={DEMO_WORK_QUEUE} linkMode="demo" onOpenDemoClient={onOpen} />,
    );
    expect(hrefs()).toEqual([]);
    const open = [...host.querySelectorAll("button")].find((b) => b.textContent === "Open binder")!;
    await act(async () => open.click());
    expect(onOpen).toHaveBeenCalledWith("demo-client-rm", "binder");
  });
});

describe.each([
  ["attorney", () => <DemoAttorneyPortal />],
  ["org", () => <DemoOrgPortal />],
  ["prep", () => <DemoPrepPortal />],
] as const)("demo %s portal", (portal, make) => {
  it("stays under /demo/*, shows the banner, and never touches network or storage", async () => {
    await render(
      <DemoPortalShell portal={portal} eyebrow="Demo" title="Demo" intro="Fictional">
        {make()}
      </DemoPortalShell>,
    );
    expect(host.textContent).toContain("DEMO · Fictional · Read-only.");
    expect(host.querySelector('[data-testid="demo-portal-switcher"]')).not.toBeNull();
    // Click every control (tabs, open client, disabled actions) and re-check links each time.
    await clickAll();
    await clickAll();
    for (const h of hrefs()) {
      expect(h).not.toMatch(BANNED_HREF);
      expect(h).toMatch(ALLOWED_HREF);
    }
    expect(host.querySelectorAll("form[action], input[type=file]").length).toBe(0);
    expectNoLiveTraffic();
  });
});

describe("demo save/export/share controls are toast-only", () => {
  it("attorney binder actions only show the demo toast", async () => {
    await render(<DemoAttorneyPortal />);
    const client = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Client R.M."),
    )!;
    await act(async () => client.click());
    const actions = [...host.querySelectorAll("button")].filter((b) =>
      /demo only/i.test(b.textContent ?? ""),
    );
    expect(actions.length).toBeGreaterThanOrEqual(4);
    for (const a of actions) await act(async () => a.click());
    expect(toastInfo).toHaveBeenCalledTimes(actions.length);
    expectNoLiveTraffic();
  });

  it("org approve / export / invite only show the demo toast", async () => {
    await render(<DemoOrgPortal />);
    const actions = [...host.querySelectorAll("button")].filter((b) =>
      /demo only/i.test(b.textContent ?? ""),
    );
    expect(actions.length).toBe(3);
    for (const a of actions) await act(async () => a.click());
    expect(toastInfo).toHaveBeenCalledTimes(3);
    expect(host.textContent).not.toMatch(/GrantReport|OrgOversight/);
  });
});

describe("demo prep practice is in-memory only", () => {
  function textarea() {
    return host.querySelector("textarea") as HTMLTextAreaElement;
  }
  async function type(value: string) {
    const ta = textarea();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(ta, value);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("shows the practice-only notice and turns autocomplete off", async () => {
    await render(<DemoPrepPractice />);
    expect(DEMO_PRACTICE_NOTICE).toBe(
      "Practice only. Don't type real names, addresses, or details. Nothing is saved.",
    );
    expect(host.textContent).toContain(DEMO_PRACTICE_NOTICE);
    expect(textarea().getAttribute("autocomplete")).toBe("off");
    expect(host.querySelector("form")?.getAttribute("autocomplete")).toBe("off");
    expect(textarea().getAttribute("name")).toBeNull();
    expect(host.querySelector("[data-demo-practice]")?.className).toContain("no-print");
  });

  it("clears typed text the moment Quick Exit is pressed", async () => {
    await render(
      <>
        <button type="button" data-quick-exit="true">
          Exit safely
        </button>
        <DemoPrepPractice />
      </>,
    );
    await type("pretend words");
    expect(textarea().value).toBe("pretend words");
    const exit = host.querySelector<HTMLButtonElement>("[data-quick-exit]")!;
    await act(async () => exit.click());
    expect(textarea().value).toBe("");
    expectNoLiveTraffic();
  });

  it("clears on double Escape and on page hide", async () => {
    await render(<DemoPrepPractice />);
    await type("pretend words");
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(textarea().value).toBe("");
    await type("again");
    await act(async () => window.dispatchEvent(new Event("pagehide")));
    expect(textarea().value).toBe("");
  });

  it("is gone after leaving the practice section (unmount) and is never stored or sent", async () => {
    await render(<DemoPrepPortal />);
    const tab = (label: RegExp) =>
      [...host.querySelectorAll("button")].find((b) => label.test(b.textContent ?? ""))!;
    await act(async () => tab(/^Practice/).click());
    await type("pretend words");
    await act(async () => tab(/^Printable guide$/).click());
    expect(host.querySelector("textarea")).toBeNull();
    await act(async () => tab(/^Practice/).click());
    expect(textarea().value).toBe("");
    expectNoLiveTraffic();
  });
});
