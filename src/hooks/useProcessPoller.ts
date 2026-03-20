// src/hooks/useProcessPoller.ts
// Heartbeat of the app. Polls fetchProcesses at the configured scan interval.

import { useEffect, useRef } from "react";
import { useProcessStore } from "@/stores/processStore";

/**
 * Polls for process updates at the configured scan interval.
 *
 * Lifecycle:
 * 1. On mount: fetch immediately (so the UI isn't empty for 5 seconds)
 * 2. Start interval at settings.scanInterval
 * 3. If scanInterval changes: clear old interval, start new one
 * 4. On unmount: clear interval
 *
 * The store's fetchProcesses already guards against concurrent scans
 * via the isScanning flag, so no additional debounce/guard is needed here.
 */
export function useProcessPoller(): void {
  const fetchProcesses = useProcessStore((s) => s.fetchProcesses);
  const scanInterval = useProcessStore((s) => s.settings.scanInterval);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Immediate fetch on mount
    fetchProcesses();

    // Start polling
    intervalRef.current = setInterval(fetchProcesses, scanInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchProcesses, scanInterval]);
}
