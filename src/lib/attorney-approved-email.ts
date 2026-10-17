/**
 * Plain-text notice sent when a founder approves an attorney application.
 * Deliberately contains no client, case, or invitation details: an email can be
 * read on a shared device, so it only says the account was approved.
 */
export function attorneyApprovedEmail(origin: string) {
  const base = origin.replace(/\/+$/, "");
  return {
    subject: "Your PatternProof attorney access is approved",
    text:
      `Your PatternProof attorney application was approved.\n\n` +
      `Sign in with the same email address, then return to the invitation link your client ` +
      `sent you. If that link has expired, ask your client to send a new one. ` +
      `You can also finish setting up your account at ${base}/setup.\n\n` +
      `Client records stay private until each client chooses to share with you.`,
  };
}
