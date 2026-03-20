// src/components/Header.tsx
// Minimal title bar: app name + refresh button.

import { memo } from "react";
import { RefreshIcon, SettingsIcon } from "@/components/icons";
import { useProcessStore } from "@/stores/processStore";

const Header = memo(function Header() {
  const setView = useProcessStore((s) => s.setView);
  const fetchProcesses = useProcessStore((s) => s.fetchProcesses);
  const isScanning = useProcessStore((s) => s.isScanning);
  const lastUpdated = useProcessStore((s) => s.lastUpdated);

  const refreshTitle = lastUpdated
    ? `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}`
    : "Refresh";

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between px-4 py-2.5 border-b border-surface-200 dark:border-surface-700"
    >
      {/* App name */}
      <span
        data-tauri-drag-region
        className="text-[14px] font-semibold tracking-tight text-surface-800 dark:text-surface-100"
      >
        localhost
      </span>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => fetchProcesses()}
          disabled={isScanning}
          className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50"
          title={refreshTitle}
          aria-label="Refresh process list"
        >
          <RefreshIcon
            size={15}
            spinning={isScanning}
            className={
              isScanning
                ? "text-surface-600 dark:text-surface-300"
                : "text-surface-400 dark:text-surface-500"
            }
          />
        </button>

        <button
          onClick={() => setView("settings")}
          className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50"
          title="Settings"
          aria-label="Open settings"
        >
          <SettingsIcon
            size={15}
            className="text-surface-400 dark:text-surface-500"
          />
        </button>
      </div>
    </div>
  );
});

export default Header;
