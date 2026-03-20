// src/components/Footer.tsx
// Minimal bar showing aggregate process count.

import { memo } from "react";
import {
  useProcessStore,
  selectTotalProcesses,
  selectProjectCount,
} from "@/stores/processStore";

const Footer = memo(function Footer() {
  const totalProcesses = useProcessStore(selectTotalProcesses);
  const projectCount = useProcessStore(selectProjectCount);

  return (
    <div className="px-4 py-2 border-t border-surface-200 dark:border-surface-700 text-[11px] text-surface-400 dark:text-surface-500 tabular-nums">
      {totalProcesses} {totalProcesses === 1 ? "process" : "processes"}
      {" \u00B7 "}
      {projectCount} {projectCount === 1 ? "project" : "projects"}
    </div>
  );
});

export default Footer;
