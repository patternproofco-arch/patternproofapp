// Declining an attorney application and saving the reason is ONE database call, so it
// either fully succeeds or changes nothing. The optional email is sent only after that
// call succeeds; an email failure never undoes or hides a completed decline.
export type DeclineDb = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
};

export type DeclineEmailFn = (
  subject: string,
  text: string,
  key: string,
  to: string,
) => Promise<{ sent?: boolean }>;

export async function declineAttorneyApplication(input: {
  db: DeclineDb;
  id: string;
  reviewer: string;
  reason?: string | null;
  sendEmail: boolean;
  sendEmailFn: DeclineEmailFn;
}) {
  const { db, id, reviewer, sendEmail, sendEmailFn } = input;
  const reason = input.reason?.trim() || null;
  if (sendEmail && !reason) throw new Error("Write a reason before choosing to email it.");

  const { data: app, error: lookupError } = await db
    .from("attorney_access_applications")
    .select("id,email,full_name")
    .eq("id", id)
    .maybeSingle();
  if (lookupError || !app) throw new Error("Could not find that application.");

  // With a reason: one atomic database function (status, shares and reason together).
  // Without a reason: the existing review function, which needs no new columns.
  const { error } = reason
    ? await db.rpc("decline_attorney_application", {
        _id: id,
        _reviewer: reviewer,
        _reason: reason,
      })
    : await db.rpc("review_attorney_application", {
        _id: id,
        _reviewer: reviewer,
        _status: "rejected",
      });
  if (error) {
    throw new Error(
      reason
        ? "Nothing was changed. The decline and reason could not be saved together."
        : "Could not save the review.",
    );
  }

  let emailed = false;
  let emailProblem = false;
  if (sendEmail && reason) {
    try {
      const result = await sendEmailFn(
        "Your PatternProof attorney application",
        `Hello ${app.full_name},\n\nThank you for applying for attorney access to PatternProof. We are not able to approve your application right now.\n\nReason from our team:\n${reason}\n\nIf something above is out of date or incorrect, you are welcome to reply to this email and we will take another look.\n\n— The PatternProof team`,
        `attorney-decline-${id}`,
        String(app.email),
      );
      emailed = !!result.sent;
      if (emailed) {
        const { error: stampError } = await db
          .from("attorney_access_applications")
          .update({ decline_reason_emailed_at: new Date().toISOString() })
          .eq("id", id);
        if (stampError) emailProblem = true;
      } else {
        emailProblem = true;
      }
    } catch {
      emailProblem = true;
    }
  }
  return { ok: true as const, emailed, emailProblem };
}
