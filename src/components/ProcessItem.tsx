// src/components/ProcessItem.tsx
// Single process row. Layout: PORT  process_name  /relative/path  [info]

import { memo, useCallback } from "react";
import PortBadge from "@/components/PortBadge";
import { InfoIcon } from "@/components/icons";
import { useProcessStore } from "@/stores/processStore";
import type { Process } from "@/types";

interface ProcessItemProps {
  process: Process;
}

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

  // Secondary label: process runtime name (node, python, etc.)
  const processLabel =
    process.source === "docker" && process.dockerInfo
      ? process.dockerInfo.containerName
      : process.name;

  // Tertiary label: relative path within the project (/frontend, /backend, etc.)
  const pathLabel =
    process.source !== "docker" && process.relativePath
      ? process.relativePath
      : null;

  return (
    <div
      role="listitem"
      className={[
        "group flex items-center gap-2.5 px-4 py-1.5",
        "hover:bg-surface-100 dark:hover:bg-surface-800",
        "transition-colors duration-100 cursor-default",
        isSelected
          ? "bg-surface-100 dark:bg-surface-800 border-l-2 border-surface-400 dark:border-surface-500"
          : "border-l-2 border-transparent",
      ].join(" ")}
    >
      {/* Port -- primary, most prominent */}
      <PortBadge
        port={process.port}
        source={process.source}
        processName={process.name}
      />

      {/* Process name -- secondary */}
      <span
        className="text-[12px] font-mono text-surface-600 dark:text-surface-300 flex-shrink-0"
        title={processLabel}
      >
        {processLabel}
      </span>

      {/* Relative path -- tertiary, subtle, takes remaining space */}
      {pathLabel && (
        <span
          className="flex-1 min-w-0 text-[11px] font-mono text-surface-400 dark:text-surface-500 truncate"
          title={pathLabel}
        >
          {pathLabel}
        </span>
      )}
      {!pathLabel && <span className="flex-1" />}

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
