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
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-400 dark:text-neutral-500">
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
          className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          Settings
        </button>
      </div>
    </div>
  );
});

export default Footer;
