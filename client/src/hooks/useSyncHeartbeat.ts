import { useEffect, useRef } from "react";
import { useQueryClient, Query } from "@tanstack/react-query";

export default function useSyncHeartbeat() {
  const qc = useQueryClient();
  const lastRev = useRef<number>(0);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/sync/status");
        const { revision } = await res.json();

        if (typeof revision === "number" && revision !== lastRev.current) {
          lastRev.current = revision;

          // Invalidate ALL queries that start with "assets" (handles filters, pagination, etc.)
          qc.invalidateQueries({
            predicate: (q: Query) => Array.isArray(q.queryKey) && q.queryKey[0] === "assets",
          });
        }
      } catch {
        /* ignore */
      }
    }, 60_000); // every 60 seconds

    return () => clearInterval(id);
  }, [qc]);
}
