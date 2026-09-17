import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** What the in-app notification banner shows while the app is open.
 *  There is no OS-level push notification in this app — nothing reaches a
 *  locked phone. This only controls what she (or anyone glancing at her
 *  screen while she's using it, especially under a disguise name) sees
 *  rendered inside the app itself. */
export type PpNotificationContent = "full" | "generic" | "off";

export interface PpSettings {
  disguiseName: string;
  exitUrl: string;
  sessionTimeoutSec: number;
  state: string;
  city: string;
  /** @deprecated unused — kept so old localStorage blobs still parse. Use notificationContent. */
  notificationsEnabled: boolean;
  notificationContent: PpNotificationContent;
  iconStyle: string;
  onboarded: boolean;
  quickRecordVisible: boolean;
  quickRecordFrozen: boolean;
  /** Neutral frequency observations. Off unless she turns it on. */
  frequencyObservationsEnabled: boolean;
  /** Optional in-app guide. Off unless she turns it on. */
  guideEnabled: boolean;
  /** Personal appearance — independent of the disguise name/exit URL above.
   *  No accent-color choice here: persona accents (indigo/oxblood) are
   *  LOCKED per styles.css — see settings-wireframe artifact for the two
   *  options under review before that changes. */
  theme: "light" | "dim";
  textScale: 100 | 115 | 130;
  /** Explicit override. The OS-level prefers-reduced-motion is already
   *  honored regardless of this; this is only for someone whose device
   *  setting doesn't reflect what they want inside this one app. */
  reduceMotion: boolean;
}

const DEFAULTS: PpSettings = {
  disguiseName: "Daily Planner",
  exitUrl: "https://weather.com",
  sessionTimeoutSec: 60,
  state: "",
  city: "",
  notificationsEnabled: false,
  notificationContent: "full",
  iconStyle: "Calendar",
  onboarded: false,
  quickRecordVisible: true,
  quickRecordFrozen: false,
  frequencyObservationsEnabled: false,
  guideEnabled: false,
  theme: "light",
  textScale: 100,
  reduceMotion: false,
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

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.ppTheme = settings.theme;
    root.dataset.ppTextScale = String(settings.textScale);
    root.dataset.ppReduceMotion = String(settings.reduceMotion);
  }, [settings.theme, settings.textScale, settings.reduceMotion]);

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
