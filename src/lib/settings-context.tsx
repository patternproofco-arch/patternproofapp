import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface PpSettings {
  disguiseName: string;
  exitUrl: string;
  sessionTimeoutSec: number;
  state: string;
  city: string;
  notificationsEnabled: boolean;
  iconStyle: string;
  onboarded: boolean;
  quickRecordVisible: boolean;
  quickRecordFrozen: boolean;
  /** Neutral frequency observations. Off unless she turns it on. */
  frequencyObservationsEnabled: boolean;
  /** Optional in-app guide. Off unless she turns it on. */
  guideEnabled: boolean;
}

const DEFAULTS: PpSettings = {
  disguiseName: "Daily Planner",
  exitUrl: "https://weather.com",
  sessionTimeoutSec: 60,
  state: "",
  city: "",
  notificationsEnabled: false,
  iconStyle: "Calendar",
  onboarded: false,
  quickRecordVisible: true,
  quickRecordFrozen: false,
  frequencyObservationsEnabled: false,
  guideEnabled: false,
};

const KEY = "pp_settings_v1";

interface Ctx {
  settings: PpSettings;
  update: (patch: Partial<PpSettings>) => void;
}

const SettingsCtx = createContext<Ctx>({ settings: DEFAULTS, update: () => {} });

export function SettingsProvider({
  children,
  applyDisguiseTitle = true,
}: {
  children: ReactNode;
  /** Only the signed-in app wears the disguise title. Public pages keep their
   *  own route metadata so search results and tabs stay branded. */
  applyDisguiseTitle?: boolean;
}) {
  const [settings, setSettings] = useState<PpSettings>(DEFAULTS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (applyDisguiseTitle && typeof document !== "undefined") {
      document.title = settings.disguiseName || "Daily Planner";
    }
  }, [settings.disguiseName, applyDisguiseTitle]);

  const update = (patch: Partial<PpSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return <SettingsCtx.Provider value={{ settings, update }}>{children}</SettingsCtx.Provider>;
}

export const useSettings = () => useContext(SettingsCtx);