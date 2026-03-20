// src/stores/processStore.ts
// Flat Zustand store -- single store, no nesting, no providers.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProjectGroup, Process, Settings, AppView } from "@/types";
import * as tauri from "@/lib/tauri";

interface ProcessState {
  // --- Data ---
  projects: ProjectGroup[];
  lastUpdated: number | null; // Date.now() of last successful scan
  isScanning: boolean; // true while a scan is in-flight
  error: string | null; // last scan error message, null if OK

  // --- UI State ---
  view: AppView; // "main" | "settings" | "detail"
  selectedProcess: Process | null; // process shown in DetailPanel
  collapsedProjects: Set<string>; // project names the user has collapsed

  // --- Settings (persisted) ---
  settings: Settings;

  // --- Actions: Data ---
  fetchProcesses: () => Promise<void>;
  clearError: () => void;

  // --- Actions: UI ---
  setView: (view: AppView) => void;
  selectProcess: (process: Process) => void;
  deselectProcess: () => void;
  toggleProjectCollapsed: (projectName: string) => void;

  // --- Actions: Process management ---
  stopProcess: (process: Process) => Promise<void>;
  restartProcess: (process: Process) => Promise<void>;
  openInTerminal: (path: string) => Promise<void>;
  openInEditor: (path: string) => Promise<void>;
  openInBrowser: (port: number) => Promise<void>;

  // --- Actions: Settings ---
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

// Default settings -- used on first launch
const DEFAULT_SETTINGS: Settings = {
  scanInterval: 5000,
  projectsDir: "~/Desktop/Projects",
  theme: "system",
  editorCommand: "code",
};

export const useProcessStore = create<ProcessState>()(
  persist(
    (set, get) => ({
      // --- Initial state ---
      projects: [],
      lastUpdated: null,
      isScanning: false,
      error: null,
      view: "main",
      selectedProcess: null,
      collapsedProjects: new Set(),
      settings: DEFAULT_SETTINGS,

      // --- Data actions ---

      fetchProcesses: async () => {
        // Don't stack concurrent scans
        if (get().isScanning) return;

        set({ isScanning: true });
        try {
          const projects = await tauri.getProcesses(
            get().settings.projectsDir
          );
          const prevSelected = get().selectedProcess;

          // If a process was selected, try to keep it selected by PID match
          let updatedSelected: Process | null = null;
          if (prevSelected) {
            for (const group of projects) {
              const match = group.processes.find(
                (p) => p.pid === prevSelected.pid
              );
              if (match) {
                updatedSelected = match;
                break;
              }
            }
            // Process gone -- close detail panel
          }

          set({
            projects,
            lastUpdated: Date.now(),
            isScanning: false,
            error: null,
            selectedProcess: updatedSelected,
          });
        } catch (err) {
          set({
            isScanning: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },

      clearError: () => set({ error: null }),

      // --- UI actions ---

      setView: (view) => set({ view }),

      selectProcess: (process) =>
        set({
          selectedProcess: process,
          view: "detail",
        }),

      deselectProcess: () =>
        set({
          selectedProcess: null,
          view: "main",
        }),

      toggleProjectCollapsed: (projectName) => {
        const collapsed = new Set(get().collapsedProjects);
        if (collapsed.has(projectName)) {
          collapsed.delete(projectName);
        } else {
          collapsed.add(projectName);
        }
        set({ collapsedProjects: collapsed });
      },

      // --- Process management actions ---

      stopProcess: async (process) => {
        try {
          if (process.source === "docker" && process.dockerInfo) {
            await tauri.stopDockerContainer(
              process.dockerInfo.containerId
            );
          } else {
            await tauri.stopProcess(process.pid);
          }
          // Immediately re-fetch to reflect the change
          await get().fetchProcesses();
          // If we just stopped the selected process, go back
          if (get().selectedProcess?.pid === process.pid) {
            set({ selectedProcess: null, view: "main" });
          }
        } catch (err) {
          set({ error: `Failed to stop: ${err}` });
        }
      },

      restartProcess: async (process) => {
        try {
          if (process.source === "docker" && process.dockerInfo) {
            await tauri.restartDockerContainer(
              process.dockerInfo.containerId
            );
          } else {
            await tauri.restartProcess(process.pid);
          }
          await get().fetchProcesses();
        } catch (err) {
          set({ error: `Failed to restart: ${err}` });
        }
      },

      openInTerminal: async (path) => {
        try {
          await tauri.openInTerminal(path);
        } catch (err) {
          set({ error: `Failed to open terminal: ${err}` });
        }
      },

      openInEditor: async (path) => {
        try {
          await tauri.openInEditor(path, get().settings.editorCommand);
        } catch (err) {
          set({ error: `Failed to open editor: ${err}` });
        }
      },

      openInBrowser: async (port) => {
        try {
          await tauri.openInBrowser(port);
        } catch (err) {
          set({ error: `Failed to open browser: ${err}` });
        }
      },

      // --- Settings actions ---

      loadSettings: async () => {
        try {
          const settings = await tauri.getSettings();
          set({ settings });
        } catch {
          // First launch -- use defaults, which are already set
        }
      },

      updateSettings: async (patch) => {
        const merged = { ...get().settings, ...patch };
        set({ settings: merged });
        try {
          await tauri.saveSettings(merged);
        } catch (err) {
          set({ error: `Failed to save settings: ${err}` });
        }
      },
    }),
    {
      name: "localhost-storage",
      partialize: (state) => ({
        settings: state.settings,
        collapsedProjects: Array.from(state.collapsedProjects),
      }),
      // Custom serialization for Set<string>
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        collapsedProjects: new Set(
          (persisted as Record<string, unknown>)?.collapsedProjects as
            | string[]
            | undefined ?? []
        ),
      }),
    }
  )
);

// --- Derived selectors (use outside the store to avoid re-renders) ---

/** Total number of processes across all projects */
export const selectTotalProcesses = (state: ProcessState): number =>
  state.projects.reduce((sum, g) => sum + g.processes.length, 0);

/** Total number of projects with at least one process */
export const selectProjectCount = (state: ProcessState): number =>
  state.projects.length;

/** Check if any process has a warning status */
export const selectHasWarnings = (state: ProcessState): boolean =>
  state.projects.some((g) =>
    g.processes.some((p) => p.status !== "healthy")
  );
