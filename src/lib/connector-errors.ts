/**
 * Shared failure classification for the Google Drive / Calendar connector
 * gateway calls. "not_configured" means the integration has no API key on
 * this deployment (an ops/setup issue); "upstream_error" covers everything
 * else (a bad HTTP response from the gateway/Google, or a thrown network
 * error) — both are real failures, but only the first one means the user
 * needs someone to turn the integration on rather than just retrying.
 */
export type ConnectorErrorKind = "not_configured" | "upstream_error";

export interface ConnectorFailure {
  ok: false;
  kind: ConnectorErrorKind;
  reason: string;
}

const NOT_CONFIGURED_MESSAGE = "not_configured";

export function connectorNotConfiguredError(): Error {
  return new Error(NOT_CONFIGURED_MESSAGE);
}

export function classifyConnectorError(e: unknown): ConnectorFailure {
  const message = e instanceof Error ? e.message : "unknown";
  return {
    ok: false,
    kind: message === NOT_CONFIGURED_MESSAGE ? "not_configured" : "upstream_error",
    reason: message,
  };
}
