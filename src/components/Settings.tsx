// src/components/Settings.tsx
// Settings panel with projects dir, scan interval, editor, and theme fields.

import { memo, useState, useEffect } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { useProcessStore } from "@/stores/processStore";
import type { Settings as SettingsType } from "@/types";

const Settings = memo(function Settings() {
  const settings = useProcessStore((s) => s.settings);
  const updateSettings = useProcessStore((s) => s.updateSettings);
  const setView = useProcessStore((s) => s.setView);

  // Local state for form fields (commit on blur or explicit save)
  const [local, setLocal] = useState<SettingsType>(settings);

  // Sync when store settings change externally
  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const handleSave = () => {
    updateSettings(local);
  };

  const intervalOptions = [
    { value: 2000, label: "2s" },
    { value: 5000, label: "5s" },
    { value: 10000, label: "10s" },
    { value: 30000, label: "30s" },
  ];

  const editorOptions = [
    { value: "code", label: "VS Code" },
    { value: "cursor", label: "Cursor" },
    { value: "zed", label: "Zed" },
    { value: "subl", label: "Sublime" },
    { value: "idea", label: "IntelliJ" },
  ];

  const themeOptions: Array<{ value: SettingsType["theme"]; label: string }> = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  return (
    <div className="flex flex-col h-full max-h-[500px] w-[360px] bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setView("main")}
          className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Back to main view"
        >
          <ChevronLeftIcon
            size={16}
            className="text-neutral-500 dark:text-neutral-400"
          />
        </button>
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          Settings
        </span>
      </div>

      {/* Settings form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Projects Directory */}
        <SettingsField
          label="Projects Directory"
          description="Root folder to scan for dev projects"
        >
          <input
            type="text"
            value={local.projectsDir}
            onChange={(e) =>
              setLocal({ ...local, projectsDir: e.target.value })
            }
            onBlur={handleSave}
            placeholder="~/Desktop/Projects"
            className="w-full px-3 py-2.5 text-sm font-mono bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-400/50 transition-shadow"
          />
        </SettingsField>

        {/* Scan Interval */}
        <SettingsField
          label="Scan Interval"
          description="How often to check for running processes"
        >
          <div className="flex gap-2">
            {intervalOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  const val = { ...local, scanInterval: opt.value };
                  setLocal(val);
                  updateSettings(val);
                }}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  local.scanInterval === opt.value
                    ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-neutral-900 dark:border-neutral-100"
                    : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingsField>

        {/* Editor */}
        <SettingsField
          label="Editor"
          description="CLI command to open projects in your editor"
        >
          <div className="flex flex-wrap gap-2">
            {editorOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  const val = { ...local, editorCommand: opt.value };
                  setLocal(val);
                  updateSettings(val);
                }}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  local.editorCommand === opt.value
                    ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-neutral-900 dark:border-neutral-100"
                    : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingsField>

        {/* Theme */}
        <SettingsField label="Theme" description="Appearance preference">
          <div className="flex gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  const val = { ...local, theme: opt.value };
                  setLocal(val);
                  updateSettings(val);
                }}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  local.theme === opt.value
                    ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-neutral-900 dark:border-neutral-100"
                    : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingsField>
      </div>

      {/* Save button pinned to bottom */}
      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
        <button
          onClick={handleSave}
          className="w-full py-2.5 text-sm font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
});

/** Reusable field wrapper */
function SettingsField({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-2">
        {description}
      </p>
      {children}
    </div>
  );
}

export default Settings;
