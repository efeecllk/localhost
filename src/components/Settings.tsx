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
    { value: 2000,  label: "2s" },
    { value: 5000,  label: "5s" },
    { value: 10000, label: "10s" },
    { value: 30000, label: "30s" },
  ];

  const editorOptions = [
    { value: "code",   label: "VS Code" },
    { value: "cursor", label: "Cursor" },
    { value: "zed",    label: "Zed" },
    { value: "subl",   label: "Sublime" },
    { value: "idea",   label: "IntelliJ" },
  ];

  const themeOptions: Array<{ value: SettingsType["theme"]; label: string }> = [
    { value: "system", label: "System" },
    { value: "light",  label: "Light" },
    { value: "dark",   label: "Dark" },
  ];

  // Shared classes for toggle-style option buttons
  const optionActive =
    "bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 border-surface-900 dark:border-surface-100";
  const optionInactive =
    "bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700";
  const optionBase =
    "px-3 py-2 text-[12px] rounded-lg border transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50";

  return (
    <div className="flex flex-col h-full max-h-[500px] w-[360px] bg-surface-50 dark:bg-surface-950 overflow-hidden animate-slide-down">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-200 dark:border-surface-700">
        <button
          onClick={() => setView("main")}
          className="p-1 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50"
          aria-label="Back to main view"
        >
          <ChevronLeftIcon
            size={16}
            className="text-surface-500 dark:text-surface-400"
          />
        </button>
        <span className="text-[13px] font-semibold text-surface-700 dark:text-surface-200">
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
            className="w-full px-3 py-2.5 text-[12px] font-mono bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-surface-800 dark:text-surface-200 placeholder:text-surface-300 dark:placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-surface-400/50 transition-shadow"
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
                className={`flex-1 ${optionBase} ${
                  local.scanInterval === opt.value ? optionActive : optionInactive
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
                className={`${optionBase} ${
                  local.editorCommand === opt.value ? optionActive : optionInactive
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
                className={`flex-1 ${optionBase} ${
                  local.theme === opt.value ? optionActive : optionInactive
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingsField>
      </div>

      {/* Save button pinned to bottom */}
      <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700">
        <button
          onClick={handleSave}
          className="w-full py-2.5 text-[12px] font-medium rounded-lg bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 hover:bg-surface-800 dark:hover:bg-surface-200 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50"
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
      <label className="block text-[11px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <p className="text-[11px] text-surface-400 dark:text-surface-500 mb-2">
        {description}
      </p>
      {children}
    </div>
  );
}

export default Settings;
