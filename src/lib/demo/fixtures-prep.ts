/**
 * Fictional court-prep fixtures for /demo/prep. Static content only.
 * The real practice coach (an authenticated AI call) is never used in the demo;
 * this static sample shows the shape of feedback instead.
 */
export const DEMO_PREP_PROFILE = {
  hearingTypeLabel: "Custody / parenting time (sample)",
  hearingDateLabel: "A date about six weeks out (fictional)",
  courtLabel: "Sample County Family Court (fictional)",
} as const;

export const DEMO_PRACTICE_NOTICE =
  "Practice only. Don't type real names, addresses, or details. Nothing is saved.";

export const DEMO_STATIC_COACH_SAMPLE = {
  prompt:
    "In your own words, practice how you would greet the court and ask for a moment to find an exhibit.",
  sampleAnswer:
    "Good morning, Your Honor. May I have a moment to find the page I marked as Exhibit 2?",
  feedback: [
    "Short and polite. That fits most courtrooms.",
    "You named the exhibit by its marking, which helps the clerk follow along.",
    "If you are unsure how exhibits are marked locally, ask the clerk before the hearing.",
  ],
  disclaimer:
    "Sample feedback written for this demo. Educational preparation only, not legal advice.",
} as const;
