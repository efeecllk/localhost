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

/** Status dot color mapping */
const STATUS_DOT_COLORS: Record<string, string> = {
  healthy: "bg-emerald-400",
  high_cpu: "bg-amber-400",
  high_memory: "bg-amber-400",
  crashed: "bg-red-400",
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

  const statusColor = STATUS_DOT_COLORS[process.status] ?? "bg-neutral-400";

  // Determine the display path
  const displayPath =
    process.source === "docker" && process.dockerInfo
      ? `docker/${process.dockerInfo.containerName}`
      : process.relativePath || process.name;

  return (
    <div
      className={`
        group flex items-center gap-2 px-4 py-2
        hover:bg-neutral-100 dark:hover:bg-neutral-800
        transition-colors cursor-default
        ${isSelected ? "bg-neutral-100 dark:bg-neutral-800 border-l-2 border-neutral-400 dark:border-neutral-500" : "border-l-2 border-transparent"}
      `}
    >
      {/* Status dot */}
      <div
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`}
        title={process.status.replace("_", " ")}
      />

      {/* Port badge */}
      <PortBadge
        port={process.port}
        source={process.source}
        processName={process.name}
      />

      {/* Relative path or docker container name */}
      <span className="flex-1 min-w-0 text-xs font-mono text-neutral-600 dark:text-neutral-300 truncate">
        {displayPath}
      </span>

      {/* Detail button -- visible on hover or when selected */}
      <button
        onClick={handleDetailClick}
        className={`
          flex-shrink-0 p-1 rounded-md
          hover:bg-neutral-200 dark:hover:bg-neutral-700
          transition-all
          ${isSelected ? "opacity-100 bg-neutral-200 dark:bg-neutral-700" : "opacity-0 group-hover:opacity-100"}
        `}
        aria-label={`Show details for ${process.name}${process.port ? ` on port ${process.port}` : ""}`}
        title="Details"
      >
        <InfoIcon
          size={14}
          className="text-neutral-400 dark:text-neutral-500"
        />
      </button>
    </div>
  );
});

export default ProcessItem;
