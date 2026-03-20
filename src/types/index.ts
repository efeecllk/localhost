// src/types/index.ts
// Canonical frontend types -- every component and store references these.

export type ProcessStatus = "healthy" | "high_cpu" | "high_memory" | "crashed";
export type ProcessSource = "port_scan" | "dev_tool" | "docker";

export interface DockerInfo {
  containerId: string;
  containerName: string;
  image: string;
  status: string; // Docker's own status string, e.g., "Up 2 hours"
}

export interface Process {
  pid: number;
  name: string; // e.g., "node", "postgres"
  port: number | null; // e.g., 3000, null if no port yet
  relativePath: string; // e.g., "/apps/web"
  fullPath: string; // e.g., "/Users/efe/Desktop/Projects/agent-attack/apps/web"
  uptime: number; // seconds since process started
  cpuPercent: number; // 0-100
  memoryMb: number; // in megabytes
  status: ProcessStatus;
  source: ProcessSource;
  dockerInfo?: DockerInfo;
}

export interface ProjectGroup {
  name: string; // e.g., "agent-attack"
  path: string; // e.g., "/Users/efe/Desktop/Projects/agent-attack"
  processes: Process[];
}

export interface Settings {
  scanInterval: number; // milliseconds, default 5000
  projectsDir: string; // default ~/Desktop/Projects
  theme: "system" | "light" | "dark";
  editorCommand: string; // "code", "cursor", "zed", etc.
}

// View routing (no react-router needed for a menu bar app)
export type AppView = "main" | "settings" | "detail";

// Scan result returned by the Rust backend
export interface ScanResult {
  projects: ProjectGroup[];
  scannedAt: number; // unix ms
}

// Full app state type (for reference, store uses its own interface)
export interface AppState {
  projects: ProjectGroup[];
  settings: Settings;
  view: AppView;
  selectedProcess: Process | null;
  isScanning: boolean;
  error: string | null;
  lastUpdated: number | null;
}
