export type RequestOutcome = "answer" | "unavailable" | "help_requested" | "declined";
export type RequestAction = "submit" | "unavailable" | "help_requested" | "decline";

export function requestOutcomeLabel(outcome: string | null | undefined): string | null {
  switch (outcome) {
    case "unavailable":
      return "I don't have this";
    case "help_requested":
      return "Help requested";
    case "declined":
      return "Chose not to answer";
    default:
      return null;
  }
}
