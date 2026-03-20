# localhost -- React Frontend Implementation Plan

**Date:** 2026-03-20
**Status:** Ready to implement
**Depends on:** Design doc (`2026-03-20-localhost-design.md`)

---

## 1. TypeScript Types (`src/types/index.ts`)

All types derived directly from the design doc's data model. These are the canonical frontend types -- every component and store references them.

```typescript
// src/types/index.ts

export interface Process {
  pid: number;
  name: string;                // e.g., "node", "postgres"
  port: number | null;         // e.g., 3000, null if no port yet
  relativePath: string;        // e.g., "/apps/web"
  fullPath: string;            // e.g., "/Users/efe/Desktop/Projects/agent-attack/apps/web"
  uptime: number;              // seconds since process started
  cpuPercent: number;          // 0-100
  memoryMb: number;            // in megabytes
  status: ProcessStatus;
  source: ProcessSource;
  dockerInfo?: DockerInfo;
}

export type ProcessStatus = "healthy" | "high_cpu" | "high_memory" | "crashed";
export type ProcessSource = "port_scan" | "dev_tool" | "docker";

export interface DockerInfo {
  containerId: string;
  containerName: string;
  image: string;
  status: string;              // Docker's own status string, e.g., "Up 2 hours"
}

export interface ProjectGroup {
  name: string;                // e.g., "agent-attack"
  path: string;                // e.g., "/Users/efe/Desktop/Projects/agent-attack"
  processes: Process[];
}

export interface Settings {
  scanInterval: number;        // milliseconds, default 5000
  projectsDir: string;        // default ~/Desktop/Projects
  theme: "system" | "light" | "dark";
  editorCommand: string;      // "code", "cursor", "zed", etc.
}

// View routing (no react-router needed for a menu bar app)
export type AppView = "main" | "settings" | "detail";
```

---

## 2. Tauri Invoke Wrappers (`src/lib/tauri.ts`)

Type-safe wrappers around every Tauri command. This is the ONLY file that imports `@tauri-apps/api`. Every component calls these functions instead of `invoke` directly.

```typescript
// src/lib/tauri.ts
import { invoke } from "@tauri-apps/api/core";
import type { ProjectGroup, Settings } from "../types";

/**
 * Fetch all running dev processes, grouped by project.
 * This is the main polling call -- runs every scanInterval ms.
 */
export async function getProcesses(projectsDir: string): Promise<ProjectGroup[]> {
  return invoke<ProjectGroup[]>("get_processes", { projectsDir });
}

/**
 * Send SIGTERM to a native process by PID.
 */
export async function stopProcess(pid: number): Promise<void> {
  return invoke("stop_process", { pid });
}

/**
 * Stop then restart a native process. The Rust side handles
 * re-launching using the original command and cwd.
 */
export async function restartProcess(pid: number): Promise<void> {
  return invoke("restart_process", { pid });
}

/**
 * Open a new Terminal.app window cd'd to the given path.
 */
export async function openInTerminal(path: string): Promise<void> {
  return invoke("open_in_terminal", { path });
}

/**
 * Open the given path in the user's preferred editor.
 * @param editor - CLI command, e.g. "code", "cursor"
 */
export async function openInEditor(path: string, editor: string): Promise<void> {
  return invoke("open_in_editor", { path, editor });
}

/**
 * Open http://localhost:{port} in the default browser.
 */
export async function openInBrowser(port: number): Promise<void> {
  return invoke("open_in_browser", { port });
}

/**
 * Docker-specific stop (uses container ID, not PID).
 */
export async function stopDockerContainer(containerId: string): Promise<void> {
  return invoke("stop_docker_container", { containerId });
}

/**
 * Docker-specific restart.
 */
export async function restartDockerContainer(containerId: string): Promise<void> {
  return invoke("restart_docker_container", { containerId });
}

/**
 * Load persisted settings from Rust-side storage.
 */
export async function getSettings(): Promise<Settings> {
  return invoke<Settings>("get_settings");
}

/**
 * Persist settings to Rust-side storage.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  return invoke("save_settings", { settings });
}
```

**Why wrap invoke?** Three reasons:
1. Type safety -- generic `invoke<T>` means the return type is checked at compile time.
2. Single point of change -- if a command name changes in Rust, we fix one file.
3. Testability -- we can mock this module in tests without touching Tauri internals.

---

## 3. Zustand Store (`src/stores/processStore.ts`)

Flat store, no nesting, no providers. Follows the same pattern as voice-prompt's `appStore.ts` but adapted for process monitoring.

### Full Store Design

```typescript
// src/stores/processStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProjectGroup, Process, Settings, AppView } from "../types";
import * as tauri from "../lib/tauri";

interface ProcessState {
  // --- Data ---
  projects: ProjectGroup[];
  lastUpdated: number | null;     // Date.now() of last successful scan
  isScanning: boolean;            // true while a scan is in-flight
  error: string | null;           // last scan error message, null if OK

  // --- UI State ---
  view: AppView;                  // "main" | "settings" | "detail"
  selectedProcess: Process | null; // process shown in DetailPanel
  collapsedProjects: Set<string>;  // project names the user has collapsed

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
          const projects = await tauri.getProcesses(get().settings.projectsDir);
          const prevSelected = get().selectedProcess;

          // If a process was selected, try to keep it selected by PID match
          let updatedSelected: Process | null = null;
          if (prevSelected) {
            for (const group of projects) {
              const match = group.processes.find(p => p.pid === prevSelected.pid);
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

      selectProcess: (process) => set({
        selectedProcess: process,
        view: "detail",
      }),

      deselectProcess: () => set({
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
            await tauri.stopDockerContainer(process.dockerInfo.containerId);
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
            await tauri.restartDockerContainer(process.dockerInfo.containerId);
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
      merge: (persisted: any, current) => ({
        ...current,
        ...(persisted as object),
        collapsedProjects: new Set(
          (persisted as any)?.collapsedProjects ?? []
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
  state.projects.some(g =>
    g.processes.some(p => p.status !== "healthy")
  );
```

### Key Design Decisions

- **`collapsedProjects` as `Set<string>`**: Persisted as an array, hydrated back to a Set. This lets users collapse project groups and have that survive restarts.
- **`selectedProcess` auto-update**: On each poll, the store finds the updated version of the selected process by PID. If the process is gone (user stopped it externally), the detail panel auto-closes.
- **No separate `actionInProgress` state**: Stop/restart actions immediately trigger `fetchProcesses` after completion. The `isScanning` flag covers the loading indicator.
- **Settings persisted via Zustand `persist` AND Rust**: The Zustand persist gives instant hydration on app load. The Rust `save_settings` call ensures the backend also knows current settings (for scan interval, projects dir).

---

## 4. `useProcessPoller` Hook (`src/hooks/useProcessPoller.ts`)

This hook is the heartbeat of the app. It runs `fetchProcesses` on an interval and handles lifecycle correctly.

```typescript
// src/hooks/useProcessPoller.ts
import { useEffect, useRef } from "react";
import { useProcessStore } from "../stores/processStore";

/**
 * Polls for process updates at the configured scan interval.
 *
 * Lifecycle:
 * 1. On mount: fetch immediately (so the UI isn't empty for 5 seconds)
 * 2. Start interval at settings.scanInterval
 * 3. If scanInterval changes: clear old interval, start new one
 * 4. On unmount: clear interval
 *
 * Diffing strategy:
 * - The Rust backend returns the full ProjectGroup[] every time.
 * - The store's set() call triggers Zustand's shallow equality check.
 * - React only re-renders components whose specific slice of state changed.
 * - We do NOT do manual diffing on the frontend -- Zustand + React.memo handles it.
 *
 * Error handling:
 * - If a fetch fails, the error is stored in processStore.error.
 * - The interval keeps running -- transient failures (e.g., Docker socket
 *   briefly unavailable) self-heal on the next successful poll.
 * - The UI shows the last known good data with an error banner on top.
 */
export function useProcessPoller(): void {
  const fetchProcesses = useProcessStore((s) => s.fetchProcesses);
  const scanInterval = useProcessStore((s) => s.settings.scanInterval);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Immediate fetch on mount
    fetchProcesses();

    // Start polling
    intervalRef.current = setInterval(fetchProcesses, scanInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchProcesses, scanInterval]);
}
```

### Why NOT use `useCallback` or debounce?

- `fetchProcesses` is a stable reference from Zustand (defined once in `create`). No `useCallback` needed.
- Debounce is unnecessary because the store already guards against concurrent scans (`if (get().isScanning) return`).
- The 5-second default interval is already generous -- no risk of hammering the backend.

---

## 5. Component Breakdown

### 5.1 `App.tsx` -- Root Component

```typescript
// src/App.tsx
import { useEffect, useCallback, lazy, Suspense } from "react";
import { useProcessStore } from "./stores/processStore";
import { useProcessPoller } from "./hooks/useProcessPoller";
import MenuDropdown from "./components/MenuDropdown";

const Settings = lazy(() => import("./components/Settings"));
const DetailPanel = lazy(() => import("./components/DetailPanel"));

function App() {
  const view = useProcessStore((s) => s.view);
  const theme = useProcessStore((s) => s.settings.theme);
  const loadSettings = useProcessStore((s) => s.loadSettings);

  // Start polling
  useProcessPoller();

  // Load persisted settings from Rust on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Theme management (same pattern as voice-prompt)
  const applyTheme = useCallback((isDark: boolean) => {
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    applyTheme(theme === "dark");
  }, [theme, applyTheme]);

  const renderView = () => {
    switch (view) {
      case "settings":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <Settings />
          </Suspense>
        );
      case "detail":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <DetailPanel />
          </Suspense>
        );
      default:
        return <MenuDropdown />;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100">
      {renderView()}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-5 w-5 border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300" />
    </div>
  );
}

export default App;
```

**Behavior:**
- On mount: loads settings from Rust backend, starts the 5-second poll.
- Theme class is toggled on `<html>` element so Tailwind's `dark:` variants work.
- View switching is instant -- Settings and DetailPanel are lazy-loaded but tiny, so the spinner rarely appears.

---

### 5.2 `MenuDropdown.tsx` -- Main Container

The primary view. Contains Header, ProjectList, Footer, and error/empty states.

```typescript
// src/components/MenuDropdown.tsx
import { memo } from "react";
import Header from "./Header";
import ProjectList from "./ProjectList";
import Footer from "./Footer";
import EmptyState from "./EmptyState";
import { useProcessStore, selectTotalProcesses } from "../stores/processStore";

const MenuDropdown = memo(function MenuDropdown() {
  const projects = useProcessStore((s) => s.projects);
  const error = useProcessStore((s) => s.error);
  const totalProcesses = useProcessStore(selectTotalProcesses);

  return (
    <div className="flex flex-col h-full">
      <Header />

      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {totalProcesses === 0 ? (
          <EmptyState />
        ) : (
          <ProjectList projects={projects} />
        )}
      </div>

      <Footer />
    </div>
  );
});

export default MenuDropdown;
```

**Props:** None -- reads from store.
**Layout:** Flex column, scrollable middle, fixed header and footer.

---

### 5.3 `Header.tsx`

```typescript
// src/components/Header.tsx
import { memo } from "react";
import { useProcessStore } from "../stores/processStore";

const Header = memo(function Header() {
  const setView = useProcessStore((s) => s.setView);
  const fetchProcesses = useProcessStore((s) => s.fetchProcesses);
  const isScanning = useProcessStore((s) => s.isScanning);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
      <span className="text-sm font-semibold tracking-tight text-neutral-700 dark:text-neutral-200">
        localhost
      </span>
      <div className="flex items-center gap-1">
        {/* Manual refresh */}
        <button
          onClick={() => fetchProcesses()}
          disabled={isScanning}
          className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshIcon spinning={isScanning} />
        </button>
        {/* Settings */}
        <button
          onClick={() => setView("settings")}
          className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Settings"
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  );
});
```

**Behavior:**
- Refresh button shows a spinning animation when `isScanning` is true (CSS `animate-spin` on the icon).
- Settings gear navigates to `view: "settings"`.

---

### 5.4 `ProjectList.tsx`

```typescript
// src/components/ProjectList.tsx
import { memo } from "react";
import ProjectGroupComponent from "./ProjectGroup";
import type { ProjectGroup } from "../types";

interface ProjectListProps {
  projects: ProjectGroup[];
}

const ProjectList = memo(function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="py-1">
      {projects.map((group) => (
        <ProjectGroupComponent key={group.name} group={group} />
      ))}
    </div>
  );
});

export default ProjectList;
```

**Props:** `projects: ProjectGroup[]`
**Behavior:** Pure render -- maps project groups. Memoized so it only re-renders when the projects array reference changes.

---

### 5.5 `ProjectGroup.tsx`

```typescript
// src/components/ProjectGroup.tsx
import { memo, useCallback } from "react";
import ProcessItem from "./ProcessItem";
import { useProcessStore } from "../stores/processStore";
import type { ProjectGroup } from "../types";

interface ProjectGroupProps {
  group: ProjectGroup;
}

const ProjectGroupComponent = memo(function ProjectGroupComponent({
  group,
}: ProjectGroupProps) {
  const collapsed = useProcessStore((s) => s.collapsedProjects.has(group.name));
  const toggle = useProcessStore((s) => s.toggleProjectCollapsed);

  const handleToggle = useCallback(() => {
    toggle(group.name);
  }, [toggle, group.name]);

  return (
    <div className="mb-0.5">
      {/* Project name header -- clickable to collapse */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <ChevronIcon
          className={`w-3 h-3 transition-transform duration-150 ${
            collapsed ? "-rotate-90" : "rotate-0"
          }`}
        />
        <span>{group.name}</span>
        <span className="ml-auto text-neutral-400 dark:text-neutral-600 normal-case tracking-normal font-normal">
          {group.processes.length}
        </span>
      </button>

      {/* Process list -- animated collapse */}
      {!collapsed && (
        <div className="space-y-px">
          {group.processes.map((process) => (
            <ProcessItem key={process.pid} process={process} />
          ))}
        </div>
      )}
    </div>
  );
});

export default ProjectGroupComponent;
```

**Props:** `group: ProjectGroup`
**State from store:** `collapsedProjects` (to check if this group is collapsed)
**Behavior:**
- Click the group header to collapse/expand.
- Chevron rotates smoothly with `transition-transform`.
- Process count badge on the right side of the header.

---

### 5.6 `ProcessItem.tsx`

The most important component -- one row per process in the list.

```typescript
// src/components/ProcessItem.tsx
import { memo, useCallback } from "react";
import PortBadge from "./PortBadge";
import { useProcessStore } from "../stores/processStore";
import type { Process } from "../types";

interface ProcessItemProps {
  process: Process;
}

const ProcessItem = memo(function ProcessItem({ process }: ProcessItemProps) {
  const selectProcess = useProcessStore((s) => s.selectProcess);

  const handleDetailClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectProcess(process);
    },
    [selectProcess, process]
  );

  // Status indicator color
  const statusColor = {
    healthy: "bg-emerald-400",
    high_cpu: "bg-amber-400",
    high_memory: "bg-amber-400",
    crashed: "bg-red-400",
  }[process.status];

  return (
    <div className="group flex items-center gap-2 px-4 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-default">
      {/* Status dot */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`} />

      {/* Port badge */}
      <PortBadge port={process.port} />

      {/* Relative path or docker container name */}
      <span className="flex-1 text-sm text-neutral-600 dark:text-neutral-300 truncate">
        {process.source === "docker" && process.dockerInfo
          ? `docker/${process.dockerInfo.containerName}`
          : process.relativePath}
      </span>

      {/* Detail button -- visible on hover */}
      <button
        onClick={handleDetailClick}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
        title="Details"
      >
        <InfoIcon className="w-3.5 h-3.5 text-neutral-400" />
      </button>
    </div>
  );
});

export default ProcessItem;
```

**Props:** `process: Process`
**Behavior:**
- Shows a colored status dot (green/amber/red).
- Port badge on the left, relative path in the middle, info button on the right.
- Info button only visible on hover (`opacity-0 group-hover:opacity-100`).
- Clicking the info button opens the DetailPanel for this process.
- Docker processes show `docker/container-name` instead of a filesystem path.

---

### 5.7 `PortBadge.tsx`

```typescript
// src/components/PortBadge.tsx
import { memo } from "react";

interface PortBadgeProps {
  port: number | null;
}

const PortBadge = memo(function PortBadge({ port }: PortBadgeProps) {
  if (port === null) {
    return (
      <span className="w-14 text-xs text-neutral-400 dark:text-neutral-600 font-mono">
        ----
      </span>
    );
  }

  return (
    <span className="w-14 text-xs font-mono font-medium text-blue-600 dark:text-blue-400">
      :{port}
    </span>
  );
});

export default PortBadge;
```

**Props:** `port: number | null`
**Behavior:** Fixed width so ports align vertically. Null ports show `----` as a placeholder.

---

### 5.8 `DetailPanel.tsx` -- Process Detail View

Full-screen slide-in panel showing detailed info and action buttons for a single process.

```typescript
// src/components/DetailPanel.tsx
import { memo, useCallback } from "react";
import ActionButtons from "./ActionButtons";
import { useProcessStore } from "../stores/processStore";
import { formatUptime, formatMemory } from "../lib/format";

const DetailPanel = memo(function DetailPanel() {
  const process = useProcessStore((s) => s.selectedProcess);
  const deselectProcess = useProcessStore((s) => s.deselectProcess);

  if (!process) return null;

  const statusLabel = {
    healthy: "Healthy",
    high_cpu: "High CPU",
    high_memory: "High Memory",
    crashed: "Crashed",
  }[process.status];

  const statusColor = {
    healthy: "text-emerald-500",
    high_cpu: "text-amber-500",
    high_memory: "text-amber-500",
    crashed: "text-red-500",
  }[process.status];

  return (
    <div className="flex flex-col h-full">
      {/* Back button header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={deselectProcess}
          className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          {process.name}
        </span>
        {process.port && (
          <span className="text-sm font-mono text-blue-500">:{process.port}</span>
        )}
      </div>

      {/* Process details */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Status" value={statusLabel} className={statusColor} />
          <StatCard label="Uptime" value={formatUptime(process.uptime)} />
          <StatCard label="CPU" value={`${process.cpuPercent.toFixed(1)}%`} />
          <StatCard label="Memory" value={formatMemory(process.memoryMb)} />
        </div>

        {/* Path info */}
        <div className="space-y-2">
          <InfoRow label="Path" value={process.relativePath} />
          <InfoRow label="Full Path" value={process.fullPath} mono />
          <InfoRow label="PID" value={String(process.pid)} mono />
          <InfoRow label="Source" value={process.source.replace("_", " ")} />
        </div>

        {/* Docker-specific info */}
        {process.dockerInfo && (
          <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <InfoRow label="Container" value={process.dockerInfo.containerName} />
            <InfoRow label="Image" value={process.dockerInfo.image} mono />
            <InfoRow label="Docker Status" value={process.dockerInfo.status} />
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
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
        {label}
      </div>
      <div className={`text-sm font-medium ${className}`}>{value}</div>
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
      <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
        {label}
      </span>
      <span
        className={`text-xs text-right break-all ${
          mono ? "font-mono" : ""
        } text-neutral-700 dark:text-neutral-300`}
      >
        {value}
      </span>
    </div>
  );
}

export default DetailPanel;
```

**Props:** None -- reads `selectedProcess` from store.
**Layout:** Back button header, 2x2 stats grid, info rows, action buttons pinned at bottom.
**Behavior:**
- Back button calls `deselectProcess()` which sets view back to "main".
- Stats update live on each poll (because the store auto-updates `selectedProcess` by PID match).
- Docker-specific section only renders if `process.dockerInfo` exists.

---

### 5.9 `ActionButtons.tsx`

```typescript
// src/components/ActionButtons.tsx
import { memo } from "react";
import { useProcessStore } from "../stores/processStore";
import type { Process } from "../types";

interface ActionButtonsProps {
  process: Process;
}

const ActionButtons = memo(function ActionButtons({ process }: ActionButtonsProps) {
  const store = useProcessStore();

  const actions = [
    {
      label: "Stop",
      icon: <StopIcon />,
      onClick: () => store.stopProcess(process),
      variant: "danger" as const,
    },
    {
      label: "Restart",
      icon: <RestartIcon />,
      onClick: () => store.restartProcess(process),
      variant: "default" as const,
    },
    {
      label: "Terminal",
      icon: <TerminalIcon />,
      onClick: () => store.openInTerminal(process.fullPath),
      variant: "default" as const,
    },
    {
      label: "Editor",
      icon: <CodeIcon />,
      onClick: () => store.openInEditor(process.fullPath),
      variant: "default" as const,
    },
    ...(process.port
      ? [
          {
            label: "Browser",
            icon: <GlobeIcon />,
            onClick: () => store.openInBrowser(process.port!),
            variant: "default" as const,
          },
        ]
      : []),
    {
      label: "Copy Port",
      icon: <ClipboardIcon />,
      onClick: () => {
        if (process.port) {
          navigator.clipboard.writeText(String(process.port));
        }
      },
      variant: "default" as const,
      hidden: !process.port,
    },
  ].filter((a) => !("hidden" in a && a.hidden));

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-800 p-3">
      <div className="grid grid-cols-3 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors ${
              action.variant === "danger"
                ? "hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
            }`}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

export default ActionButtons;
```

**Props:** `process: Process`
**Layout:** 3-column grid of icon buttons with labels.
**Behavior:**
- Stop button is styled as danger (red).
- Browser and Copy Port only show if the process has a port.
- Copy Port uses the clipboard API directly (no Tauri invoke needed).
- Stop action auto-navigates back to main view after success (handled in store).

---

### 5.10 `Footer.tsx`

```typescript
// src/components/Footer.tsx
import { memo } from "react";
import { useProcessStore, selectTotalProcesses, selectProjectCount } from "../stores/processStore";

const Footer = memo(function Footer() {
  const totalProcesses = useProcessStore(selectTotalProcesses);
  const projectCount = useProcessStore(selectProjectCount);
  const lastUpdated = useProcessStore((s) => s.lastUpdated);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-400 dark:text-neutral-500">
      <span>
        {totalProcesses} {totalProcesses === 1 ? "process" : "processes"}
        {" - "}
        {projectCount} {projectCount === 1 ? "project" : "projects"}
      </span>
      {lastUpdated && (
        <span title={new Date(lastUpdated).toLocaleTimeString()}>
          updated
        </span>
      )}
    </div>
  );
});

export default Footer;
```

**Props:** None -- reads from store selectors.
**Behavior:** Shows "6 processes - 3 projects" plus a subtle "updated" label.

---

### 5.11 `EmptyState.tsx`

```typescript
// src/components/EmptyState.tsx
import { memo } from "react";

const EmptyState = memo(function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12 text-center">
      <div className="text-4xl mb-4 opacity-30">://</div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        No active processes
      </p>
      <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">
        Start a dev server and it will appear here
      </p>
    </div>
  );
});

export default EmptyState;
```

**Props:** None.
**Behavior:** Shows the `://` logo mark at large size with reduced opacity, plus explanatory text. Clean and minimal.

---

### 5.12 `Settings.tsx`

```typescript
// src/components/Settings.tsx
import { memo, useState, useEffect } from "react";
import { useProcessStore } from "../stores/processStore";
import type { Settings as SettingsType } from "../types";

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setView("main")}
          className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          Settings
        </span>
      </div>

      {/* Settings form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Projects Directory */}
        <SettingsField label="Projects Directory" description="Root folder to scan for dev projects">
          <input
            type="text"
            value={local.projectsDir}
            onChange={(e) => setLocal({ ...local, projectsDir: e.target.value })}
            onBlur={handleSave}
            className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </SettingsField>

        {/* Scan Interval */}
        <SettingsField label="Scan Interval" description="How often to check for running processes">
          <select
            value={local.scanInterval}
            onChange={(e) => {
              const val = { ...local, scanInterval: Number(e.target.value) };
              setLocal(val);
              updateSettings(val);
            }}
            className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value={2000}>2 seconds</option>
            <option value={5000}>5 seconds (default)</option>
            <option value={10000}>10 seconds</option>
            <option value={30000}>30 seconds</option>
          </select>
        </SettingsField>

        {/* Editor */}
        <SettingsField label="Editor" description="CLI command to open projects in your editor">
          <select
            value={local.editorCommand}
            onChange={(e) => {
              const val = { ...local, editorCommand: e.target.value };
              setLocal(val);
              updateSettings(val);
            }}
            className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="code">VS Code</option>
            <option value="cursor">Cursor</option>
            <option value="zed">Zed</option>
            <option value="subl">Sublime Text</option>
            <option value="idea">IntelliJ IDEA</option>
          </select>
        </SettingsField>

        {/* Theme */}
        <SettingsField label="Theme" description="Appearance preference">
          <div className="flex gap-2">
            {(["system", "light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  const val = { ...local, theme: t };
                  setLocal(val);
                  updateSettings(val);
                }}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  local.theme === t
                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                    : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </SettingsField>
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
      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">
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
```

**What is configurable:**
1. **Projects directory** -- text input, path to root folder (default `~/Desktop/Projects`).
2. **Scan interval** -- dropdown: 2s, 5s (default), 10s, 30s.
3. **Editor command** -- dropdown: VS Code, Cursor, Zed, Sublime, IntelliJ.
4. **Theme** -- three toggle buttons: System, Light, Dark.

**How settings persist:**
- Zustand `persist` middleware saves to `localStorage` for instant hydration.
- `updateSettings` also calls `tauri.saveSettings()` so the Rust backend knows the current scan interval and projects directory.
- On app launch, `loadSettings()` fetches from Rust backend and overwrites any stale localStorage values.

---

## 6. Utility Functions (`src/lib/format.ts`)

```typescript
// src/lib/format.ts

/**
 * Format seconds into human-readable uptime.
 * 45 -> "45s", 3600 -> "1h 0m", 7384 -> "2h 3m"
 */
export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format memory in MB to a readable string.
 * 128 -> "128 MB", 1536 -> "1.5 GB"
 */
export function formatMemory(mb: number): string {
  if (mb < 1024) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
```

---

## 7. Tailwind CSS Configuration and Styling Approach

### `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // No custom colors needed -- neutral palette + semantic colors from defaults.
      // The app uses neutral-50 through neutral-900 for surfaces,
      // blue for interactive elements, emerald/amber/red for status.
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "SF Pro Text",
          "Helvetica Neue", "sans-serif"
        ],
        mono: ["SF Mono", "Menlo", "Monaco", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
    },
  },
  plugins: [],
};
```

### Styling Principles

1. **Dark mode first** -- most developers use dark mode. The `dark:` variants should look excellent. Light mode is secondary but fully supported.

2. **Color palette:**
   - **Surfaces:** `neutral-50` (light bg) / `neutral-900` (dark bg). Headers and footers use borders in `neutral-200` / `neutral-800`.
   - **Text:** `neutral-800` (light) / `neutral-100` (dark) for primary. `neutral-500` / `neutral-400` for secondary.
   - **Ports:** `blue-600` / `blue-400` -- the most important visual element, must pop.
   - **Status dots:** `emerald-400` (healthy), `amber-400` (warning), `red-400` (crashed).
   - **Actions:** `red-500` for stop/danger, `neutral-600` for everything else.

3. **Typography:**
   - System font stack (`-apple-system` / `SF Pro`) for body text -- matches macOS native feel.
   - Monospace (`SF Mono`) for ports, PIDs, paths -- technical data should look technical.
   - Sizes: `text-sm` (14px) for process items, `text-xs` (12px) for labels and metadata.

4. **Layout constants:**
   - Window width: 360px (set in `tauri.conf.json`, not CSS).
   - Max height: 500px (set in `tauri.conf.json`).
   - Padding: `px-4` horizontal, `py-2`/`py-3` vertical.
   - PortBadge: fixed `w-14` so all ports align.

5. **Animations:**
   - Refresh icon: `animate-spin` when `isScanning`.
   - Chevron rotation on collapse: `transition-transform duration-150`.
   - Info button reveal: `opacity-0 group-hover:opacity-100 transition-all`.
   - No heavy animations -- this is a utility app, not a marketing site.

6. **Scrollbar styling:**
   ```css
   /* src/styles/index.css */
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

   /* Thin macOS-style scrollbar */
   ::-webkit-scrollbar {
     width: 6px;
   }
   ::-webkit-scrollbar-track {
     background: transparent;
   }
   ::-webkit-scrollbar-thumb {
     background: theme('colors.neutral.300');
     border-radius: 3px;
   }
   .dark ::-webkit-scrollbar-thumb {
     background: theme('colors.neutral.700');
   }

   /* Prevent text selection in the menu bar UI */
   body {
     user-select: none;
     -webkit-user-select: none;
   }
   ```

---

## 8. Icons

Use inline SVG components rather than an icon library. The app only needs about 10 icons, so importing an entire icon library (Lucide, Heroicons) would bloat the bundle unnecessarily.

Create `src/components/icons.tsx` with named exports:

| Icon | Used In | Purpose |
|------|---------|---------|
| `RefreshIcon` | Header | Manual refresh, spins when scanning |
| `SettingsIcon` | Header | Navigate to settings |
| `ChevronIcon` | ProjectGroup | Collapse/expand indicator |
| `ChevronLeftIcon` | DetailPanel, Settings | Back button |
| `InfoIcon` | ProcessItem | Open detail panel |
| `StopIcon` | ActionButtons | Stop process |
| `RestartIcon` | ActionButtons | Restart process |
| `TerminalIcon` | ActionButtons | Open in Terminal |
| `CodeIcon` | ActionButtons | Open in editor |
| `GlobeIcon` | ActionButtons | Open in browser |
| `ClipboardIcon` | ActionButtons | Copy port/path |

Each icon is a simple functional component accepting `className` and optionally a `spinning` boolean (for RefreshIcon):

```typescript
export function RefreshIcon({ className = "", spinning = false }: { className?: string; spinning?: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ${spinning ? "animate-spin" : ""} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
```

---

## 9. Step-by-Step Implementation Order

Build in this exact order. Each step produces a working (if incomplete) app.

### Phase 1: Skeleton (Day 1)

**Goal:** App opens from tray, shows a styled window with static mock data.

1. **`src/types/index.ts`** -- Define all TypeScript interfaces. No logic, just types. This file is referenced by everything else, so do it first.

2. **`src/lib/tauri.ts`** -- Write all invoke wrappers. They will fail at runtime until the Rust backend is built, but the types are correct. This lets you develop the frontend in isolation.

3. **`src/lib/format.ts`** -- Pure utility functions. Write `formatUptime` and `formatMemory` with a few quick manual tests in the console.

4. **`src/components/icons.tsx`** -- All SVG icon components. Get these out of the way early so no component is blocked by a missing icon.

5. **`src/styles/index.css`** -- Tailwind directives + scrollbar + `user-select: none`.

6. **`tailwind.config.js`** -- Font families and dark mode config.

### Phase 2: Store + Polling (Day 1-2)

**Goal:** Store is functional with mock data; polling infrastructure is in place.

7. **`src/stores/processStore.ts`** -- Full Zustand store. Start by hardcoding mock data in `fetchProcesses` (return a static `ProjectGroup[]` instead of calling `tauri.getProcesses`). This lets you build and test the entire UI before the Rust backend exists.

   Mock data for development:
   ```typescript
   const MOCK_PROJECTS: ProjectGroup[] = [
     {
       name: "agent-attack",
       path: "/Users/efe/Desktop/Projects/agent-attack",
       processes: [
         { pid: 1234, name: "node", port: 3000, relativePath: "/apps/web", fullPath: "...", uptime: 3600, cpuPercent: 2.1, memoryMb: 128, status: "healthy", source: "port_scan" },
         { pid: 1235, name: "node", port: 8080, relativePath: "/apps/api", fullPath: "...", uptime: 3600, cpuPercent: 5.3, memoryMb: 256, status: "high_cpu", source: "port_scan" },
         { pid: 0, name: "postgres", port: 5432, relativePath: "docker/postgres", fullPath: "...", uptime: 7200, cpuPercent: 0.5, memoryMb: 64, status: "healthy", source: "docker", dockerInfo: { containerId: "abc123", containerName: "postgres", image: "postgres:15", status: "Up 2 hours" } },
       ],
     },
     {
       name: "voice-prompt",
       path: "/Users/efe/Desktop/Projects/voice-prompt",
       processes: [
         { pid: 2345, name: "node", port: 1420, relativePath: "/", fullPath: "...", uptime: 900, cpuPercent: 1.2, memoryMb: 96, status: "healthy", source: "port_scan" },
       ],
     },
   ];
   ```

8. **`src/hooks/useProcessPoller.ts`** -- Polling hook. Works immediately with mock data.

### Phase 3: Core Components (Day 2)

**Goal:** The main list view is fully functional with mock data.

9. **`src/components/EmptyState.tsx`** -- Simplest component. Verify it renders correctly when `projects` is empty.

10. **`src/components/PortBadge.tsx`** -- Small, no dependencies.

11. **`src/components/ProcessItem.tsx`** -- Single process row. Wire up the info button to `selectProcess`.

12. **`src/components/ProjectGroup.tsx`** -- Project header + process list. Wire up collapse/expand.

13. **`src/components/ProjectList.tsx`** -- Maps `ProjectGroup` components.

14. **`src/components/Footer.tsx`** -- Process and project counts from selectors.

15. **`src/components/Header.tsx`** -- Title, refresh button, settings button.

16. **`src/components/MenuDropdown.tsx`** -- Assembles Header + ProjectList/EmptyState + Footer.

### Phase 4: Detail Panel (Day 2-3)

**Goal:** Clicking a process shows full details with working action buttons.

17. **`src/components/ActionButtons.tsx`** -- Grid of action buttons. Actions call store methods (which call tauri wrappers).

18. **`src/components/DetailPanel.tsx`** -- Stats grid, info rows, action buttons. Back button returns to main view.

### Phase 5: Settings (Day 3)

**Goal:** Settings view is functional and persists changes.

19. **`src/components/Settings.tsx`** -- Form with all four settings fields. Changes save to both Zustand persist and Rust backend.

### Phase 6: App Shell (Day 3)

**Goal:** Everything wired together in `App.tsx`.

20. **`src/App.tsx`** -- View router, theme management, polling initialization.

21. **`src/main.tsx`** -- React root mount.

### Phase 7: Integration (Day 4)

**Goal:** Remove mock data, connect to real Rust backend.

22. Remove mock data from `processStore.ts`, uncomment the real `tauri.getProcesses` call.

23. Test end-to-end: tray click opens window, processes appear, detail panel works, stop/restart work, settings persist across restarts.

24. Polish: test dark/light mode, verify scrolling behavior, check edge cases (0 processes, 50+ processes, very long paths, processes without ports).

### Phase 8: Final Polish (Day 4)

25. Add `React.memo` to any component that re-renders unnecessarily (check with React DevTools profiler).

26. Verify bundle size with `pnpm build` -- target under 150KB gzipped for the JS bundle.

27. Test window show/hide behavior: clicking outside should hide, clicking tray icon should toggle.

---

## 10. File Tree Summary

```
src/
  types/
    index.ts              # All TypeScript interfaces
  lib/
    tauri.ts              # Tauri invoke wrappers (10 functions)
    format.ts             # formatUptime, formatMemory
  stores/
    processStore.ts       # Zustand store (single flat store)
  hooks/
    useProcessPoller.ts   # 5s polling hook
  components/
    icons.tsx             # 11 SVG icon components
    MenuDropdown.tsx      # Main container view
    Header.tsx            # Title + refresh + settings
    ProjectList.tsx       # Maps ProjectGroup[]
    ProjectGroup.tsx      # Collapsible group with header
    ProcessItem.tsx       # Single process row
    PortBadge.tsx         # Port number display
    DetailPanel.tsx       # Full process detail view
    ActionButtons.tsx     # Stop, restart, terminal, editor, browser, copy
    Footer.tsx            # Process/project counts
    EmptyState.tsx        # "No active processes"
    Settings.tsx          # Configurable settings form
  styles/
    index.css             # Tailwind + scrollbar + user-select
  App.tsx                 # Root: view routing + theme + polling init
  main.tsx                # React root mount
```

Total: **19 files**, all small and focused. No file should exceed 200 lines.

---

## 11. Key Patterns and Conventions

1. **Every component is `memo`'d.** This is a polling app -- state updates every 5 seconds. Without `memo`, every component re-renders on every poll even if its data hasn't changed.

2. **Selectors for derived data.** `selectTotalProcesses` and `selectProjectCount` are defined outside the store and passed to `useProcessStore()`. This gives Zustand fine-grained subscription -- Footer only re-renders when the count changes, not when any process field changes.

3. **No `useEffect` for data fetching in components.** All fetching happens in the `useProcessPoller` hook (called once in `App.tsx`) and in store actions. Components are purely presentational.

4. **View routing without react-router.** The app has exactly three views (main, detail, settings). A simple `view` string in the store is sufficient. React Router would add bundle size for zero benefit.

5. **Lazy loading for secondary views.** `DetailPanel` and `Settings` are lazy-loaded because they are not needed on initial render. The main list view loads instantly.

6. **One store, flat shape.** No nested stores, no separate "ui store" and "data store". Everything in one `useProcessStore`. The app's state is small enough that splitting would add complexity without benefit.

7. **Tauri wrappers are async functions, not hooks.** They return promises and are called from store actions. This keeps the invoke layer framework-agnostic and easy to test.

8. **CSS-only animations.** No Framer Motion or React Spring. The only animations are Tailwind's built-in `transition-*` utilities and `animate-spin`. A menu bar utility app should feel snappy, not cinematic.
