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
    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
      {/* Left: identity */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-mono text-neutral-400 dark:text-neutral-500">
          ://
        </span>
        <span className="text-sm font-semibold tracking-tight text-neutral-700 dark:text-neutral-200">
          localhost
        </span>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-1">
        {/* Manual refresh */}
        <button
          onClick={() => fetchProcesses()}
          disabled={isScanning}
          className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
          title={refreshTitle}
          aria-label="Refresh process list"
        >
          <RefreshIcon
            size={16}
            spinning={isScanning}
            className={
              isScanning
                ? "text-neutral-600 dark:text-neutral-300"
                : "text-neutral-400 dark:text-neutral-500"
            }
          />
        </button>

        {/* Settings */}
        <button
          onClick={() => setView("settings")}
          className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Settings"
          aria-label="Open settings"
        >
          <SettingsIcon
            size={16}
            className="text-neutral-400 dark:text-neutral-500"
          />
        </button>
      </div>
    </div>
  );
});

export default Header;
