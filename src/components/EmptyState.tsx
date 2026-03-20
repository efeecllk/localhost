// src/components/EmptyState.tsx
// Shown when no processes are found after a successful scan.

import { memo } from "react";
import { FolderIcon } from "@/components/icons";
import { useProcessStore } from "@/stores/processStore";

const EmptyState = memo(function EmptyState() {
  const isScanning = useProcessStore((s) => s.isScanning);
  const lastUpdated = useProcessStore((s) => s.lastUpdated);

  // First scan (never completed) -- show scanning state
  if (!lastUpdated && isScanning) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300" />
        </div>
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
          Scanning...
        </p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 leading-relaxed max-w-[200px]">
          Looking for running processes in your projects directory
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <FolderIcon
          size={24}
          className="text-neutral-300 dark:text-neutral-600"
        />
      </div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
        No active processes
      </p>
      <p className="text-xs text-neutral-400 dark:text-neutral-600 leading-relaxed max-w-[200px]">
        Start a dev server and it will appear here
      </p>
    </div>
  );
});

export default EmptyState;
