import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getEarlierAttorneyRequests } from "@/lib/founder-operations.functions";
import { AttorneyRequestsPanel } from "@/components/admin/AttorneyRequestsPanel";
import { Button } from "@/components/ui/button";

type EarlierRequests = Awaited<ReturnType<typeof getEarlierAttorneyRequests>>;

export function EarlierAttorneyRequests() {
  const get = useServerFn(getEarlierAttorneyRequests);
  const [data, setData] = useState<EarlierRequests | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await get());
    } catch {
      setError("Could not load earlier attorney requests. Try again.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-4 space-y-4">
      <Button variant="outline" disabled={loading} onClick={() => void load()}>
        {error ? "Retry earlier requests" : "Refresh earlier requests"}
      </Button>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading earlier requests…</p>}
      {data && (
        <AttorneyRequestsPanel applications={data.applications} onChange={() => void load()} />
      )}
    </div>
  );
}
