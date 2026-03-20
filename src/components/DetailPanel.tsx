// src/components/DetailPanel.tsx
// Full process detail view with stats grid, info rows, and action buttons.

import { memo } from "react";
import ActionButtons from "@/components/ActionButtons";
import { ChevronLeftIcon } from "@/components/icons";
import { useProcessStore } from "@/stores/processStore";
import { formatUptime, formatMemory } from "@/lib/format";

const DetailPanel = memo(function DetailPanel() {
  const process = useProcessStore((s) => s.selectedProcess);
  const deselectProcess = useProcessStore((s) => s.deselectProcess);

  if (!process) return null;

  const statusLabel: Record<string, string> = {
    healthy:     "Healthy",
    high_cpu:    "High CPU",
    high_memory: "High Memory",
    crashed:     "Crashed",
  };

  // Text color for the status chip label — matches status-* palette
  const statusTextColor: Record<string, string> = {
    healthy:     "text-[#5A7A60]  dark:text-[#A8C4AC]",
    high_cpu:    "text-[#9A7A30]  dark:text-[#DDB84A]",
    high_memory: "text-[#9A7A30]  dark:text-[#DDB84A]",
    crashed:     "text-[#8A4A4A]  dark:text-[#D4A0A0]",
  };

  // Background + ring for the status chip
  const statusBgColor: Record<string, string> = {
    healthy:
      "bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800/50",
    high_cpu:
      "bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800/50",
    high_memory:
      "bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800/50",
    crashed:
      "bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800/50",
  };

  return (
    <div className="flex flex-col h-full animate-detail-expand">
      {/* Back button header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-200 dark:border-surface-700">
        <button
          onClick={deselectProcess}
          className="p-1 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50"
          aria-label="Back to process list"
        >
          <ChevronLeftIcon
            size={16}
            className="text-surface-500 dark:text-surface-400"
          />
        </button>
        <span className="text-[13px] font-semibold text-surface-700 dark:text-surface-200">
          {process.name}
        </span>
        {process.port && (
          <span className="text-[12px] font-mono tabular-nums text-surface-500 dark:text-surface-400">
            :{process.port}
          </span>
        )}
        {/* Status chip */}
        <span
          className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${
            statusTextColor[process.status] ?? "text-surface-500"
          } ${statusBgColor[process.status] ?? ""}`}
        >
          {statusLabel[process.status] ?? process.status}
        </span>
      </div>

      {/* Process details */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Uptime" value={formatUptime(process.uptime)} />
          <StatCard label="PID" value={String(process.pid)} mono />
          <StatCard
            label="CPU"
            value={`${process.cpuPercent.toFixed(1)}%`}
            highlight={process.status === "high_cpu"}
          />
          <StatCard
            label="Memory"
            value={formatMemory(process.memoryMb)}
            highlight={process.status === "high_memory"}
          />
        </div>

        {/* Path info */}
        <div className="space-y-2">
          <InfoRow label="Path" value={process.relativePath} />
          <InfoRow label="Full Path" value={process.fullPath} mono />
          <InfoRow
            label="Source"
            value={process.source.replace("_", " ")}
          />
        </div>

        {/* Docker-specific info */}
        {process.dockerInfo && (
          <div className="space-y-2 pt-2 border-t border-surface-200 dark:border-surface-700">
            <InfoRow
              label="Container"
              value={process.dockerInfo.containerName}
            />
            <InfoRow label="Image" value={process.dockerInfo.image} mono />
            <InfoRow
              label="Docker Status"
              value={process.dockerInfo.status}
            />
            <InfoRow
              label="Container ID"
              value={process.dockerInfo.containerId.slice(0, 12)}
              mono
            />
          </div>
        )}
      </div>

      {/* Action buttons pinned to bottom */}
      <ActionButtons process={process} />
    </div>
  );
});

/** Reusable stat card for the 2x2 grid */
function StatCard({
  label,
  value,
  className = "",
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  className?: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="bg-surface-100 dark:bg-surface-800 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-surface-400 dark:text-surface-500 mb-1">
        {label}
      </div>
      <div
        className={`text-[12px] font-medium tabular-nums ${mono ? "font-mono" : ""} ${
          highlight
            ? "text-[#C9A962] dark:text-[#DDB84A]"
            : "text-surface-700 dark:text-surface-200"
        } ${className}`}
      >
        {value}
      </div>
    </div>
  );
}

/** Single info row: label on left, value on right */
function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-surface-400 dark:text-surface-500 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={`text-[12px] text-right break-all ${
          mono ? "font-mono" : ""
        } text-surface-700 dark:text-surface-300`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

export default DetailPanel;
