/**
 * Survivor-facing wording for optional two-step sign-in.
 * Kept in one place so Experience can review every line without reading code.
 * Tone: plain, calm, soft-claim. No promises of absolute safety.
 */
export const SURVIVOR_TWO_STEP_COPY = {
  heading: "Two-step sign-in (optional)",
  intro:
    "This adds a second check when you sign in. After your password, you enter a 6-digit code from an authenticator app on your phone. It stays off unless you turn it on.",
  noSms:
    "We never send codes by text message. A phone plan can be shared or viewed by someone else, so codes come from an app on your device instead.",
  startButton: "Set up two-step sign-in",
  scanStep:
    "Open an authenticator app (for example Google Authenticator, Authy, 1Password or iCloud Passwords) and scan this code.",
  keyLabel: "Setup key — shown only this once",
  keyPrivate:
    "If you keep a private copy of this key, you can add it to a new phone later. Anyone who has it can make your codes, so only keep it somewhere just you can reach — not in a shared note, shared email, or your photos. It's fine not to keep it.",
  codeStep: "Then enter the 6-digit code the app shows.",
  confirmButton: "Check code and turn on",
  turnedOn: "Two-step sign-in is on.",
  onStatus: "On — you'll be asked for a code after your password.",
  addSecond: "Add a second authenticator app",
  addSecondHint:
    "Optional. A second app, on another device you control, can be a backup if you lose your phone.",
  removeLabel: "Code from any of your authenticator apps",
  removeButton: "Remove this app",
  removedOne: "That authenticator app was removed.",
  turnedOff: "Two-step sign-in is off.",
  lostHeading: "If you lose your phone",
  lostBody:
    "Use your second authenticator app or the setup key you kept, if you have one. If you have neither, contact PatternProof support from the Support page. We'll take steps to check it's really you before we remove two-step sign-in, and we won't switch it off just because someone emails asking.",
  resetNote:
    "Resetting your password by email does not turn this off, so a code is still needed to open your account.",
} as const;
