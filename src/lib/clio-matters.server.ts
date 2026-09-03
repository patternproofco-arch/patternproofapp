// Server-only: read-only Clio Manage matters listing.
import { getValidClioAccessToken } from "@/lib/clio.server";

const CLIO_API_BASE = "https://app.clio.com/api/v4";
const FIELDS = "id,display_number,description,status,client{id,name}";
const LIMIT = 200;

export interface ClioMatter {
  id: string;
  display_number: string | null;
  description: string | null;
  status: string | null;
  client_name: string | null;
}

export class ClioNotConnectedError extends Error {}
export class ClioReauthError extends Error {}
export class ClioRateLimitError extends Error {}

export async function listClioMatters(
  userId: string,
  opts?: { query?: string },
): Promise<ClioMatter[]> {
  const token = await getValidClioAccessToken(userId);
  if (!token) {
    throw new ClioNotConnectedError(
      "Clio isn't connected yet. Connect your Clio account to browse matters.",
    );
  }

  const url = new URL(`${CLIO_API_BASE}/matters.json`);
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("limit", String(LIMIT));
  const query = opts?.query?.trim();
  if (query) url.searchParams.set("query", query);

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 401) {
    throw new ClioReauthError(
      "Your Clio session has expired. Reconnect Clio to keep browsing matters.",
    );
  }
  if (res.status === 429) {
    throw new ClioRateLimitError(
      "Clio is rate-limiting requests right now. Try again in a minute.",
    );
  }
  if (res.status === 403) {
    throw new Error(
      "Clio declined access to matters. The connected account may need Matters (read) permission, then reconnect.",
    );
  }
  if (!res.ok) {
    console.error("[clio] matters request failed", res.status, await res.text().catch(() => ""));
    throw new Error("We couldn't reach Clio just now. Try again in a moment.");
  }

  const json = (await res.json()) as {
    data?: Array<{
      id?: number | string;
      display_number?: string | null;
      description?: string | null;
      status?: string | null;
      client?: { id?: number | string; name?: string | null } | null;
    }>;
  };

  let matters: ClioMatter[] = (json.data ?? []).map((m) => ({
    id: m.id != null ? String(m.id) : "",
    display_number: m.display_number ?? null,
    description: m.description ?? null,
    status: m.status ?? null,
    client_name: m.client?.name ?? null,
  }));

  // Clio's `query` param isn't guaranteed across accounts; narrow locally too.
  if (query) {
    const needle = query.toLowerCase();
    const filtered = matters.filter((m) =>
      [m.display_number, m.description, m.client_name].some((v) =>
        v?.toLowerCase().includes(needle),
      ),
    );
    if (filtered.length) matters = filtered;
  }

  return matters.slice(0, LIMIT);
}
