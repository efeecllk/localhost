# localhost — Design Document

**Date:** 2026-03-20
**Author:** Efe Celik
**Status:** Planning

---

## 1. Overview

**localhost** is a macOS menu bar app that automatically detects and displays all running development processes, grouped by project. It scans port listeners, known dev tools, and Docker containers every 5 seconds, giving developers a single place to see what's running across all their projects.

### Problem Statement

When working on multiple projects simultaneously (each with frontends, backends, databases, etc.), it becomes chaotic to track:
- What processes are currently running
- Which project each process belongs to
- What port each service is using
- Which services were left running accidentally

### Solution

A lightweight menu bar app that automatically detects all running dev processes, groups them by project folder, and provides quick actions to manage them — all without any manual configuration.

### App Name: `localhost`

---

## 2. Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Framework** | Tauri 2.0 | Direct Rust access to system APIs, ~5-10MB bundle (vs ~150MB Electron). Native process scanning without shelling out. |
| **Frontend** | React 18 + TypeScript | Proven in voice-prompt, component model maps perfectly to the UI (ProcessList → ProjectGroup → ProcessItem → DetailPanel). |
| **Styling** | Tailwind CSS | Utility-first, handles dark/light mode easily. Fixed-width menu bar UI is simple to style. |
| **State Management** | Zustand | No boilerplate, no providers. Simple flat process list that updates every 5s. No deeply nested atomic state — one list updates together. Jotai/Redux would be overkill. |
| **Process Detection** | `sysinfo` Rust crate | Cross-platform process info (CPU, memory, ports, PIDs) natively. Makes future Windows support almost free. |
| **Docker Detection** | `bollard` Rust crate | Async Docker API client for Rust. Queries containers, images, ports. |
| **Build Tool** | Vite | Fast frontend bundling, same as voice-prompt. |
| **Distribution** | Homebrew tap + GitHub Actions | Same CI/CD pipeline pattern as voice-prompt. |

---

## 3. UI Design

### 3.1 Menu Bar Icon

Initial: `://` text-based icon in menu bar.
Future: Custom logo (same approach as voice-prompt).

### 3.2 Main Dropdown View (Two-Level List)

```
://                          <- menu bar icon
+-----------------------------+
| localhost                    |
|------------------------------|
| agent-attack                 |
|   :3000  /apps/web           |
|   :8080  /apps/api        i  |
|   :5432  docker/postgres   i  |
|                              |
| rapper                       |
|   :3001  /frontend         i  |
|   :8081  /backend          i  |
|                              |
| voice-prompt                 |
|   :1420  tauri dev         i  |
|------------------------------|
| 6 processes - 3 projects     |
+-----------------------------+
```

**Main focus per process line:**
- Port number (e.g., `:3000`)
- Project-relative path or identifier (e.g., `/apps/web`)
- Detail button (i)

**Footer:** Total process count and project count.

### 3.3 Detail Panel (on click i button)

Shows additional info:
- **Process name** (e.g., `node`, `python`, `postgres`)
- **Uptime** (e.g., `2h 34m`)
- **CPU usage** (e.g., `3.2%`)
- **Memory usage** (e.g., `128 MB`)
- **Health status** (healthy / crashed / high resource usage)

**Quick Actions:**
- Stop process
- Restart process
- Open in Terminal
- Open in VS Code / Cursor
- Open in Browser (if it has a port)
- Copy port to clipboard
- Copy path to clipboard

### 3.4 Empty State

When no processes are running: "No active processes" with a subtle illustration. Clean and honest — the app's job is to show what's running, not to launch things.

### 3.5 Window Specs

- Fixed width: ~360px (same as voice-prompt)
- Height: Dynamic based on number of processes, max ~500px with scroll
- Appears below tray icon on click
- Hides when user clicks outside (same behavior as voice-prompt)
- Dark/light mode support

---

## 4. Process Detection Architecture

Three detection engines run in parallel every 5 seconds:

### 4.1 Port Scanner

- Uses `sysinfo` crate to list all processes with open TCP listening ports
- Reads each process's `cwd` (current working directory)
- Walks up the directory tree looking for project markers:
  - `package.json`
  - `Cargo.toml`
  - `go.mod`
  - `pyproject.toml`
  - `requirements.txt`
  - `.git`
- If `cwd` falls under `~/Desktop/Projects/`, groups under that project folder name

### 4.2 Known Dev Tool Detector

Matches process names against a built-in list:
- **JavaScript/Node:** `node`, `deno`, `bun`
- **Python:** `python`, `python3`, `uvicorn`, `gunicorn`, `flask`, `django`
- **Go:** `go`, `air` (live reload)
- **Rust:** `cargo`, `rustc`
- **Ruby:** `ruby`, `rails`, `puma`
- **Java:** `java`, `gradle`, `mvn`
- **Databases:** `postgres`, `mysql`, `mongod`, `redis-server`
- **Servers:** `nginx`, `caddy`, `httpd`

Catches processes that might not be listening on a port yet (compiling, starting up).

### 4.3 Docker Container Scanner

- Queries Docker socket (`/var/run/docker.sock`) via `bollard` crate
- Extracts: container name, image, exposed ports, status, uptime
- Maps containers to projects via:
  1. `com.docker.compose.project.working_dir` label (Docker Compose sets this automatically)
  2. Falls back to container name matching against project folder names
  3. If no match: groups under "Docker" category

### 4.4 Project Resolution Logic

```
process cwd -> walk up to find .git or package.json
  -> found under ~/Desktop/Projects/X? -> group under "X"
  -> found elsewhere? -> group under folder name
  -> can't determine? -> group under "Other"
```

### 4.5 Refresh Cycle

- Poll interval: every 5 seconds
- Manual refresh button available for instant accuracy
- Efficient diffing: only update UI when process list actually changes
- Rust backend returns `Vec<ProjectGroup>` as JSON via Tauri invoke

---

## 5. Data Model

```typescript
// Frontend types

interface Process {
  pid: number;
  name: string;              // e.g., "node", "postgres"
  port: number | null;       // e.g., 3000
  relativePath: string;      // e.g., "/apps/web"
  fullPath: string;          // e.g., "/Users/efe/Desktop/Projects/agent-attack/apps/web"
  uptime: number;            // seconds
  cpuPercent: number;
  memoryMb: number;
  status: "healthy" | "high_cpu" | "high_memory" | "crashed";
  source: "port_scan" | "dev_tool" | "docker";
  dockerInfo?: DockerInfo;
}

interface DockerInfo {
  containerId: string;
  containerName: string;
  image: string;
  status: string;
}

interface ProjectGroup {
  name: string;              // e.g., "agent-attack"
  path: string;              // e.g., "/Users/efe/Desktop/Projects/agent-attack"
  processes: Process[];
}

interface AppState {
  projects: ProjectGroup[];
  lastUpdated: number;
  isScanning: boolean;
  settings: Settings;
}

interface Settings {
  scanInterval: number;      // default: 5000ms
  projectsDir: string;       // default: ~/Desktop/Projects
  theme: "system" | "light" | "dark";
  editorCommand: string;     // default: "code" (VS Code), "cursor", etc.
}
```

```rust
// Rust backend types

#[derive(Serialize, Deserialize)]
struct ProcessInfo {
    pid: u32,
    name: String,
    port: Option<u16>,
    cwd: String,
    relative_path: String,
    uptime_secs: u64,
    cpu_percent: f32,
    memory_mb: u64,
    source: String,
    docker_info: Option<DockerContainerInfo>,
}

#[derive(Serialize, Deserialize)]
struct DockerContainerInfo {
    container_id: String,
    container_name: String,
    image: String,
    status: String,
}

#[derive(Serialize, Deserialize)]
struct ProjectGroup {
    name: String,
    path: String,
    processes: Vec<ProcessInfo>,
}
```

---

## 6. Tauri Commands (Rust → Frontend API)

```rust
#[tauri::command]
fn get_processes(projects_dir: String) -> Result<Vec<ProjectGroup>, String>

#[tauri::command]
fn stop_process(pid: u32) -> Result<(), String>

#[tauri::command]
fn restart_process(pid: u32) -> Result<(), String>

#[tauri::command]
fn open_in_terminal(path: String) -> Result<(), String>

#[tauri::command]
fn open_in_editor(path: String, editor: String) -> Result<(), String>

#[tauri::command]
fn open_in_browser(port: u16) -> Result<(), String>

#[tauri::command]
fn stop_docker_container(container_id: String) -> Result<(), String>

#[tauri::command]
fn restart_docker_container(container_id: String) -> Result<(), String>

#[tauri::command]
fn get_settings() -> Result<Settings, String>

#[tauri::command]
fn save_settings(settings: Settings) -> Result<(), String>
```

---

## 7. Component Architecture (React)

```
App
├── MenuDropdown (main container)
│   ├── Header ("localhost" title + refresh button)
│   ├── ProjectList (scrollable area)
│   │   ├── ProjectGroup (per project)
│   │   │   ├── ProjectHeader (project name)
│   │   │   └── ProcessItem (per process)
│   │   │       ├── PortBadge (:3000)
│   │   │       ├── ProcessPath (/apps/web)
│   │   │       └── DetailButton (i)
│   │   └── ... more ProjectGroups
│   ├── Footer (process count + project count)
│   └── DetailPanel (slide-out or modal)
│       ├── ProcessInfo (name, uptime, CPU, memory, status)
│       └── ActionButtons (stop, restart, terminal, editor, browser, copy)
├── Settings (lazy-loaded)
│   ├── Projects directory path
│   ├── Scan interval
│   ├── Editor preference
│   └── Theme selector
└── EmptyState ("No active processes")
```

---

## 8. Distribution & Deployment

### 8.1 Homebrew (Primary)

```bash
brew tap efeecllk/localhost
brew install --cask localhost
```

Same pattern as voice-prompt:
- GitHub Actions builds DMG for both architectures (ARM64 + Intel)
- Separate workflow updates Homebrew tap with new URLs and checksums

### 8.2 GitHub Actions Workflows

**release-macos.yml:**
- Triggers on git tag push (`v*`)
- Build matrix: aarch64 (Apple Silicon) + x86_64 (Intel)
- Steps: pnpm install → Rust toolchain → tauri build
- Uploads DMG + .app to GitHub Releases

**release-windows.yml:** (future)
- NSIS installer + MSI
- `sysinfo` crate handles cross-platform process detection

**update-homebrew.yml:**
- Updates tap repo with new release URLs and checksums
- Triggered after macOS release completes

### 8.3 Build Commands

```bash
pnpm install          # Install Node dependencies
pnpm tauri dev        # Dev mode with hot reload
pnpm tauri build      # Production build
```

---

## 9. Project Structure

```
localhost/
├── src/                          # React frontend
│   ├── components/
│   │   ├── MenuDropdown.tsx
│   │   ├── ProjectList.tsx
│   │   ├── ProjectGroup.tsx
│   │   ├── ProcessItem.tsx
│   │   ├── DetailPanel.tsx
│   │   ├── PortBadge.tsx
│   │   ├── ActionButtons.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── EmptyState.tsx
│   │   └── Settings.tsx
│   ├── stores/
│   │   └── processStore.ts       # Zustand store
│   ├── hooks/
│   │   └── useProcessPoller.ts   # 5s polling hook
│   ├── lib/
│   │   └── tauri.ts              # Tauri invoke wrappers
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── styles/
│   │   └── index.css             # Tailwind
│   ├── App.tsx
│   ├── main.tsx
│   └── index.html
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── lib.rs                # Tray icon, window management
│   │   ├── main.rs               # Entry point
│   │   ├── scanner/
│   │   │   ├── mod.rs            # Scanner orchestrator
│   │   │   ├── port_scanner.rs   # TCP port listener detection
│   │   │   ├── dev_tools.rs      # Known dev tool detection
│   │   │   └── docker.rs         # Docker container scanning
│   │   ├── project_resolver.rs   # cwd → project mapping
│   │   ├── commands.rs           # Tauri invoke handlers
│   │   └── types.rs              # Rust structs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── entitlements.plist
│   ├── Info.plist
│   └── icons/
│
├── scripts/
├── docs/
│   └── plans/
├── .github/
│   └── workflows/
│       ├── release-macos.yml
│       ├── release-windows.yml
│       └── update-homebrew.yml
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── CLAUDE.md
├── README.md
└── LICENSE
```

---

## 10. Future Enhancements (Post-MVP)

- Custom logo for menu bar icon
- Windows support (sysinfo crate is already cross-platform)
- Notification when a process crashes
- Process log viewer (tail stdout/stderr)
- Project favorites / pinning
- Configurable project directories (multiple roots)
- Global keyboard shortcut to toggle dropdown
- Auto-start on login
- Process grouping by Docker Compose project name
