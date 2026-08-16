import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { seedDemoState, type DemoEvidence, type DemoIncident, type DemoState } from "./demo-data";

const STORAGE_KEY = "pp-demo-state-v1";

interface DemoContextValue extends DemoState {
  addIncident: (incident: Omit<DemoIncident, "id" | "addedInDemo">) => DemoIncident;
  attachEvidence: (evidence: Omit<DemoEvidence, "id">) => void;
  reset: () => void;
  hydrated: boolean;
}

const DemoContext = createContext<DemoContextValue | null>(null);

/**
 * Browser-only demo store. Seeded fictional records live in sessionStorage,
 * so the demo survives navigation, never reaches the database, and clears
 * itself when the tab closes.
 */
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(() => seedDemoState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as DemoState);
    } catch {
      /* fall back to the seed */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* demo still works in memory */
    }
  }, [state, hydrated]);

  const addIncident = useCallback((incident: Omit<DemoIncident, "id" | "addedInDemo">) => {
    const created: DemoIncident = { ...incident, id: `demo-${Date.now()}`, addedInDemo: true };
    setState((s) => ({ ...s, incidents: [...s.incidents, created] }));
    return created;
  }, []);

  const attachEvidence = useCallback((evidence: Omit<DemoEvidence, "id">) => {
    setState((s) => ({ ...s, evidence: [...s.evidence, { ...evidence, id: `demo-e-${Date.now()}` }] }));
  }, []);

  const reset = useCallback(() => {
    const fresh = seedDemoState();
    setState(fresh);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({ ...state, addIncident, attachEvidence, reset, hydrated }),
    [state, addIncident, attachEvidence, reset, hydrated],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}

/** Sorted oldest → newest. */
export function byDate<T extends { date: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

export function formatDemoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}
