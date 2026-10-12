/** Small native-control harness using existing React dependencies; not a general accessibility audit. */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mounted: Array<{ root: Root; host: HTMLDivElement }> = [];
type Role = "button" | "checkbox";
type Options = { name?: string | RegExp };

function matches(role: Role, options?: Options) {
  const selector = role === "checkbox" ? 'input[type="checkbox"]' : "button";
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(element => {
    const name = (element.getAttribute("aria-label") ?? element.textContent ?? "").replace(/\s+/g, " ").trim();
    return options?.name === undefined || (typeof options.name === "string" ? name === options.name : options.name.test(name));
  });
}

export const screen = {
  getByRole(role: Role, options?: Options) {
    const elements = matches(role, options);
    if (elements.length !== 1) throw new Error(`Expected one ${role}; found ${elements.length}.`);
    return elements[0];
  },
  getAllByRole(role: Role, options?: Options) {
    const elements = matches(role, options);
    if (!elements.length) throw new Error(`No ${role} found.`);
    return elements;
  },
  queryByRole(role: Role, options?: Options) { return matches(role, options)[0] ?? null; },
};

export function render(node: ReactNode) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  act(() => root.render(node));
  return { rerender: (next: ReactNode) => { act(() => root.render(next)); } };
}
export function cleanup() {
  for (const { root, host } of mounted.splice(0)) { act(() => root.unmount()); host.remove(); }
}
export const fireEvent = { click: (element: HTMLElement) => { act(() => element.click()); } };
export async function waitFor(assertion: () => unknown, timeout = 1500) {
  const deadline = Date.now() + timeout;
  let failure: unknown;
  do {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    try { assertion(); return; } catch (error) { failure = error; }
  } while (Date.now() < deadline);
  throw failure;
}
