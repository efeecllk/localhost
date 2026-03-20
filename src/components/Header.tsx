// src/components/Header.tsx
// Title bar with refresh and settings buttons.

import { memo } from "react";
import { RefreshIcon, SettingsIcon } from "@/components/icons";
import { useProcessStore } from "@/stores/processStore";

const Header = memo(function Header() {
  const setView = useProcessStore((s) => s.setView);
  const fetchProcesses = useProcessStore((s) => s.fetchProcesses);
  const isScanning = useProcessStore((s) => s.isScanning);
  const lastUpdated = useProcessStore((s) => s.lastUpdated);

  // Format tooltip for refresh button
  const refreshTitle = lastUpdated
    ? `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}`
    : "Refresh";

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700"
    >
      {/* Left: identity */}
      <div data-tauri-drag-region className="flex items-center gap-1.5">
        <span data-tauri-drag-region className="text-[13px] font-mono text-surface-400 dark:text-surface-500">
          ://
        </span>
        <span data-tauri-drag-region className="text-[13px] font-semibold tracking-tight text-surface-800 dark:text-surface-100">
          localhost
        </span>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-1">
        {/* Manual refresh */}
        <button
          onClick={() => fetchProcesses()}
          disabled={isScanning}
          className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50"
          title={refreshTitle}
          aria-label="Refresh process list"
        >
          <RefreshIcon
            size={16}
            spinning={isScanning}
            className={
              isScanning
                ? "text-surface-600 dark:text-surface-300"
                : "text-surface-400 dark:text-surface-500"
            }
          />
        </button>

        {/* Settings */}
        <button
          onClick={() => setView("settings")}
          className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50"
          title="Settings"
          aria-label="Open settings"
        >
          <SettingsIcon
            size={16}
            className="text-surface-400 dark:text-surface-500"
          />
        </button>
      </div>
    </div>
  );
});

export default Header;
