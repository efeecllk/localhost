// src/components/Footer.tsx
// Slim bar showing aggregate counts.

import { memo } from "react";
import {
  useProcessStore,
  selectTotalProcesses,
  selectProjectCount,
} from "@/stores/processStore";

const Footer = memo(function Footer() {
  const totalProcesses = useProcessStore(selectTotalProcesses);
  const projectCount = useProcessStore(selectProjectCount);
  const lastUpdated = useProcessStore((s) => s.lastUpdated);
  const setView = useProcessStore((s) => s.setView);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-200 dark:border-surface-700 text-[11px] text-surface-400 dark:text-surface-500">
      <span className="tabular-nums">
        {totalProcesses} {totalProcesses === 1 ? "process" : "processes"}
        {" \u00B7 "}
        {projectCount} {projectCount === 1 ? "project" : "projects"}
      </span>
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span title={new Date(lastUpdated).toLocaleTimeString()}>
            updated
          </span>
        )}
        <button
          onClick={() => setView("settings")}
          className="text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50 rounded"
        >
          Settings
        </button>
      </div>
    </div>
  );
});

export default Footer;
