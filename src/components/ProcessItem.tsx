// src/components/ProcessItem.tsx
// Single process row in the list. Shows status dot, port badge, path, and info button.

import { memo, useCallback } from "react";
import PortBadge from "@/components/PortBadge";
import { InfoIcon } from "@/components/icons";
import { useProcessStore } from "@/stores/processStore";
import type { Process } from "@/types";

interface ProcessItemProps {
  process: Process;
}

/**
 * Status dot color mapping.
 * Uses the design system semantic status colors via Tailwind's arbitrary-value
 * syntax so they match exactly the status-* tokens in tailwind.config.js.
 */
const STATUS_DOT_COLORS: Record<string, string> = {
  healthy:     "bg-[#7C9A82]",
  high_cpu:    "bg-[#C9A962]",
  high_memory: "bg-[#C9A962]",
  crashed:     "bg-[#B87A7A]",
};

const ProcessItem = memo(function ProcessItem({ process }: ProcessItemProps) {
  const selectProcess = useProcessStore((s) => s.selectProcess);
  const selectedPid = useProcessStore((s) => s.selectedProcess?.pid);
  const isSelected = selectedPid === process.pid;

  const handleDetailClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectProcess(process);
    },
    [selectProcess, process]
  );

  const statusColor =
    STATUS_DOT_COLORS[process.status] ?? "bg-surface-400";

  // Determine the display path
  const displayPath =
    process.source === "docker" && process.dockerInfo
      ? `docker/${process.dockerInfo.containerName}`
      : process.relativePath
        ? process.relativePath
        : "/";

  return (
    <div
      role="listitem"
      className={[
        "group flex items-center gap-2 px-4 py-2",
        "hover:bg-surface-100 dark:hover:bg-surface-800",
        "transition-colors duration-100 cursor-default",
        isSelected
          ? "bg-surface-100 dark:bg-surface-800 border-l-2 border-surface-400 dark:border-surface-500"
          : "border-l-2 border-transparent",
      ].join(" ")}
    >
      {/* Status dot */}
      <div
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`}
        aria-label={`Status: ${process.status.replace("_", " ")}`}
        title={process.status.replace("_", " ")}
      />

      {/* Port badge */}
      <PortBadge
        port={process.port}
        source={process.source}
        processName={process.name}
      />

      {/* Relative path or docker container name */}
      <span
        className="flex-1 min-w-0 text-[12px] font-mono text-surface-600 dark:text-surface-300 truncate"
        title={displayPath}
      >
        {displayPath}
      </span>

      {/* Detail button -- visible on hover or when selected */}
      <button
        onClick={handleDetailClick}
        className={[
          "flex-shrink-0 p-1 rounded-md",
          "hover:bg-surface-200 dark:hover:bg-surface-700",
          "transition-all duration-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50",
          isSelected
            ? "opacity-100 bg-surface-200 dark:bg-surface-700"
            : "opacity-0 group-hover:opacity-100",
        ].join(" ")}
        aria-label={`Show details for ${process.name}${process.port ? ` on port ${process.port}` : ""}`}
        title="Details"
      >
        <InfoIcon
          size={14}
          className="text-surface-400 dark:text-surface-500"
        />
      </button>
    </div>
  );
});

export default ProcessItem;
