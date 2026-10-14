import type { RequestAction } from "@/lib/request-response";

type RpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
};

/** Use the authenticated client: the transaction derives its actor from auth.uid(). */
export async function respondToRequest(
  client: unknown,
  input: { id: string; action: RequestAction; note?: string; evidence_ids?: string[] },
): Promise<{ shared: number }> {
  const { data, error } = await (client as RpcClient).rpc("respond_to_evidence_request", {
    p_request_id: input.id,
    p_action: input.action,
    p_note: input.note ?? "",
    p_evidence_ids: input.evidence_ids ?? [],
  });
  if (error) {
    // Do not expose provider/database diagnostics or report a partial success.
    if (error.code === "P0001") {
      throw new Error(
        "Nothing was sent. Check that sharing is still active and your selected files are available, then try again.",
      );
    }
    throw new Error("We couldn't confirm this response. Reload the request before trying again.");
  }
  const result = data as { shared?: unknown } | null;
  if (
    !result ||
    typeof result.shared !== "number" ||
    !Number.isInteger(result.shared) ||
    result.shared < 0
  ) {
    throw new Error("We couldn't confirm this response. Reload the request before trying again.");
  }
  return { shared: result.shared };
}
