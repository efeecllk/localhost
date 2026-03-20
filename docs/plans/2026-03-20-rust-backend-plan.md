# localhost -- Rust Backend Implementation Plan

**Date:** 2026-03-20
**Author:** Efe Celik
**Status:** Planning
**Depends on:** [localhost Design Document](./2026-03-20-localhost-design.md)

---

## 1. Cargo.toml Dependencies

Based on the voice-prompt project's proven Tauri 2.0 setup, extended with process scanning and Docker support.

```toml
[package]
name = "localhost"
version = "0.1.0"
description = "Menu bar app for tracking local dev processes"
authors = ["Efe Celik"]
edition = "2021"

[lib]
name = "localhost_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
# --- Tauri core ---
tauri = { version = "2", features = ["tray-icon", "image-png", "image-ico"] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-store = "2"

# --- Serialization ---
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# --- Async runtime (bollard and background scanning need this) ---
tokio = { version = "1", features = ["rt-multi-thread", "macros", "time", "process", "sync"] }

# --- Process detection ---
sysinfo = "0.33"

# --- Docker API ---
bollard = "0.18"

# --- Port scanning (read /proc/net/tcp equivalent on macOS) ---
netstat2 = "0.9"

# --- Logging ---
log = "0.4"
env_logger = "0.11"

# --- Error handling ---
thiserror = "2"

# --- Home directory resolution ---
dirs = "6"

[target.'cfg(target_os = "macos")'.dependencies]
cocoa = "0.26"
objc = "0.2"

[target.'cfg(target_os = "windows")'.dependencies]
windows = { version = "0.58", features = [
    "Win32_Foundation",
    "Win32_UI_WindowsAndMessaging",
    "Win32_Graphics_Gdi"
] }

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

### Dependency rationale

| Crate | Version | Purpose |
|-------|---------|---------|
| `sysinfo` | 0.33 | Process enumeration: PIDs, names, CPU%, memory, cwd. Replaces shelling out to `ps`/`lsof`. |
| `bollard` | 0.18 | Async Rust client for the Docker Engine API via Unix socket. Queries running containers, port mappings, labels. |
| `netstat2` | 0.9 | Maps listening TCP ports to PIDs. `sysinfo` gives process info but not port bindings; `netstat2` fills that gap without shelling out to `lsof -iTCP`. |
| `tokio` | 1.x | Required by `bollard` (async Docker calls). Also powers the background scan timer and async process spawning for "open in terminal/editor" actions. |
| `thiserror` | 2.x | Derive macro for structured error types. Avoids `.to_string()` scattered everywhere. |
| `dirs` | 6.x | Resolves `~` to the actual home directory path cross-platform. |
| `tauri-plugin-store` | 2.x | Persists user settings (scan interval, projects dir, editor, theme) to disk as JSON. |

---

## 2. Scanner Module Architecture

```
src-tauri/src/
  lib.rs                  -- Tauri app builder, tray icon, window management
  main.rs                 -- fn main() { localhost_lib::run() }
  types.rs                -- All shared structs (ProcessInfo, ProjectGroup, etc.)
  errors.rs               -- Custom error enum
  commands.rs             -- All #[tauri::command] handlers
  project_resolver.rs     -- cwd-to-project mapping logic
  scanner/
    mod.rs                -- Orchestrator: merge results from all three scanners
    port_scanner.rs       -- TCP listener detection via netstat2 + sysinfo enrichment
    dev_tools.rs          -- Known dev-tool process matching
    docker.rs             -- Docker container enumeration via bollard
```

### 2.1 `scanner/port_scanner.rs`

**Responsibility:** Find all processes listening on TCP ports and enrich them with sysinfo data (CPU, memory, cwd).

```rust
use std::collections::HashMap;
use sysinfo::{System, Pid, ProcessesToUpdate};
use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use crate::types::ProcessInfo;
use crate::errors::ScanError;

/// Build a map of PID -> Vec<port> from netstat2,
/// then enrich each with sysinfo process data.
pub fn scan_listening_ports(sys: &System) -> Result<Vec<ProcessInfo>, ScanError> {
    // Step 1: Get all TCP sockets in LISTEN state
    let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto_flags = ProtocolFlags::TCP;
    let sockets = get_sockets_info(af_flags, proto_flags)
        .map_err(|e| ScanError::NetstatError(e.to_string()))?;

    // Step 2: Build PID -> ports mapping, filtering to LISTEN only
    let mut pid_ports: HashMap<u32, Vec<u16>> = HashMap::new();
    for socket in &sockets {
        if let ProtocolSocketInfo::Tcp(tcp) = &socket.protocol_socket_info {
            if tcp.state == netstat2::TcpState::Listen {
                for pid in &socket.associated_pids {
                    pid_ports.entry(*pid).or_default().push(tcp.local_port);
                }
            }
        }
    }

    // Step 3: For each PID with listening ports, pull sysinfo data
    let mut results = Vec::new();
    for (pid, ports) in &pid_ports {
        if let Some(process) = sys.process(Pid::from_u32(*pid)) {
            let cwd = process.cwd()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let name = process.name().to_string_lossy().to_string();
            let uptime_secs = process.run_time();
            let cpu_percent = process.cpu_usage();
            let memory_mb = process.memory() / (1024 * 1024);

            // Create one ProcessInfo per port (a single process can listen
            // on multiple ports, e.g., vite dev server on 5173 + HMR on 24678)
            for port in ports {
                results.push(ProcessInfo {
                    pid: *pid,
                    name: name.clone(),
                    port: Some(*port),
                    cwd: cwd.clone(),
                    relative_path: String::new(), // filled by project_resolver
                    uptime_secs,
                    cpu_percent,
                    memory_mb,
                    status: compute_health(cpu_percent, memory_mb),
                    source: "port_scan".to_string(),
                    docker_info: None,
                });
            }
        }
    }

    Ok(results)
}
```

**Key design decisions:**

- One `ProcessInfo` per port, not per PID. A process listening on ports 3000 and 24678 produces two entries. The frontend groups them visually but the user can see each port.
- Health status is computed inline: >90% CPU = `high_cpu`, >1024 MB = `high_memory`, else `healthy`. The `crashed` status is set only if the process disappears between scans (handled in the orchestrator via diff logic).
- `relative_path` is left empty here; the orchestrator calls `project_resolver` to fill it in after all scanners run.

**Port filtering:** Ignore well-known system ports that clutter the list. Maintain a skip-list:

```rust
const IGNORED_PORTS: &[u16] = &[
    22,    // SSH
    53,    // DNS
    80,    // system httpd (not dev)
    443,   // system httpd (not dev)
    631,   // CUPS printing
    5000,  // macOS AirPlay receiver (Monterey+)
    7000,  // macOS AirPlay
];

const IGNORED_PROCESSES: &[&str] = &[
    "rapportd",
    "ControlCenter",
    "sharingd",
    "WiFiAgent",
    "AirPlayXPCHelper",
];
```

### 2.2 `scanner/dev_tools.rs`

**Responsibility:** Find running processes whose names match known dev tools, regardless of whether they have a listening port. This catches compiling Rust projects, running test suites, etc.

```rust
use std::collections::HashSet;
use sysinfo::{System, Pid};
use crate::types::ProcessInfo;

/// Known dev tool process names grouped by ecosystem.
const DEV_TOOL_NAMES: &[&str] = &[
    // JavaScript / Node
    "node", "deno", "bun", "tsx", "ts-node", "npx",
    // Python
    "python", "python3", "uvicorn", "gunicorn", "flask", "django",
    "celery", "pytest", "mypy",
    // Go
    "go", "air", "dlv",
    // Rust
    "cargo", "rustc", "rust-analyzer",
    // Ruby
    "ruby", "rails", "puma", "sidekiq", "bundle",
    // Java / JVM
    "java", "gradle", "mvn", "kotlin",
    // Databases (native, not Docker)
    "postgres", "mysqld", "mongod", "redis-server", "redis-cli",
    // Servers
    "nginx", "caddy", "httpd",
    // Build tools
    "webpack", "vite", "esbuild", "turbo", "nx",
];

pub fn scan_dev_tools(
    sys: &System,
    already_found_pids: &HashSet<u32>,
) -> Vec<ProcessInfo> {
    let tool_set: HashSet<&str> = DEV_TOOL_NAMES.iter().copied().collect();
    let mut results = Vec::new();

    for (pid, process) in sys.processes() {
        let pid_u32 = pid.as_u32();
        // Skip if port_scanner already captured this PID
        if already_found_pids.contains(&pid_u32) {
            continue;
        }

        let name = process.name().to_string_lossy().to_string();
        if tool_set.contains(name.as_str()) {
            let cwd = process.cwd()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            results.push(ProcessInfo {
                pid: pid_u32,
                name,
                port: None,
                cwd,
                relative_path: String::new(),
                uptime_secs: process.run_time(),
                cpu_percent: process.cpu_usage(),
                memory_mb: process.memory() / (1024 * 1024),
                status: "healthy".to_string(),
                source: "dev_tool".to_string(),
                docker_info: None,
            });
        }
    }

    results
}
```

**Key design decisions:**

- Accepts `already_found_pids` to avoid duplicating processes that the port scanner already captured. The port scanner is the primary source of truth; dev_tools is supplementary.
- Process name matching is exact. Future enhancement: also check the command-line args (e.g., `node ./node_modules/.bin/vite` would match `node` but the args reveal it is Vite).
- `cargo` processes are interesting edge cases: `cargo build` does not listen on any port but is absolutely a dev process worth showing.

### 2.3 `scanner/docker.rs`

**Responsibility:** Query the Docker daemon for running containers, extract port mappings, and attempt project resolution via Docker Compose labels.

```rust
use bollard::Docker;
use bollard::container::ListContainersOptions;
use std::collections::HashMap;
use crate::types::{ProcessInfo, DockerContainerInfo};
use crate::errors::ScanError;

pub async fn scan_docker_containers() -> Result<Vec<ProcessInfo>, ScanError> {
    // Connect to Docker socket. If Docker is not running, return empty vec
    // rather than an error (Docker is optional).
    let docker = match Docker::connect_with_local_defaults() {
        Ok(d) => d,
        Err(_) => return Ok(Vec::new()),
    };

    // Verify daemon is reachable
    if docker.ping().await.is_err() {
        return Ok(Vec::new());
    }

    let options = ListContainersOptions::<String> {
        all: false, // only running containers
        ..Default::default()
    };

    let containers = docker.list_containers(Some(options))
        .await
        .map_err(|e| ScanError::DockerError(e.to_string()))?;

    let mut results = Vec::new();

    for container in containers {
        let container_id = container.id.unwrap_or_default();
        let container_name = container.names
            .and_then(|n| n.first().cloned())
            .unwrap_or_default()
            .trim_start_matches('/')
            .to_string();
        let image = container.image.unwrap_or_default();
        let status = container.status.unwrap_or_default();
        let labels = container.labels.unwrap_or_default();

        // Extract exposed ports
        let ports: Vec<u16> = container.ports
            .unwrap_or_default()
            .iter()
            .filter_map(|p| p.public_port)
            .map(|p| p as u16)
            .collect();

        // Resolve project working directory from Docker Compose labels
        let compose_workdir = labels
            .get("com.docker.compose.project.working_dir")
            .cloned()
            .unwrap_or_default();

        // Determine uptime from status string (e.g., "Up 2 hours")
        let uptime_secs = parse_docker_uptime(&status);

        // If container exposes multiple ports, create one entry per port.
        // If no ports, create one entry with port = None.
        if ports.is_empty() {
            results.push(ProcessInfo {
                pid: 0, // Docker containers don't have a host PID we track
                name: format!("docker/{}", short_image_name(&image)),
                port: None,
                cwd: compose_workdir.clone(),
                relative_path: String::new(),
                uptime_secs,
                cpu_percent: 0.0,  // would need docker stats API for this
                memory_mb: 0,
                status: docker_status_to_health(&status),
                source: "docker".to_string(),
                docker_info: Some(DockerContainerInfo {
                    container_id: container_id.clone(),
                    container_name: container_name.clone(),
                    image: image.clone(),
                    status: status.clone(),
                }),
            });
        } else {
            for port in &ports {
                results.push(ProcessInfo {
                    pid: 0,
                    name: format!("docker/{}", short_image_name(&image)),
                    port: Some(*port),
                    cwd: compose_workdir.clone(),
                    relative_path: String::new(),
                    uptime_secs,
                    cpu_percent: 0.0,
                    memory_mb: 0,
                    status: docker_status_to_health(&status),
                    source: "docker".to_string(),
                    docker_info: Some(DockerContainerInfo {
                        container_id: container_id.clone(),
                        container_name: container_name.clone(),
                        image: image.clone(),
                        status: status.clone(),
                    }),
                });
            }
        }
    }

    Ok(results)
}

/// Extract short image name: "postgres:15-alpine" -> "postgres"
fn short_image_name(image: &str) -> &str {
    image.split(':').next().unwrap_or(image)
        .rsplit('/').next().unwrap_or(image)
}

/// Parse Docker uptime from status string like "Up 2 hours" or "Up 35 minutes"
fn parse_docker_uptime(status: &str) -> u64 {
    // Rough heuristic; exact parsing is not critical
    let lower = status.to_lowercase();
    if let Some(rest) = lower.strip_prefix("up ") {
        if rest.contains("second") {
            rest.split_whitespace().next()
                .and_then(|n| n.parse::<u64>().ok())
                .unwrap_or(0)
        } else if rest.contains("minute") {
            rest.split_whitespace().next()
                .and_then(|n| n.parse::<u64>().ok())
                .map(|n| n * 60)
                .unwrap_or(0)
        } else if rest.contains("hour") {
            rest.split_whitespace().next()
                .and_then(|n| n.parse::<u64>().ok())
                .map(|n| n * 3600)
                .unwrap_or(0)
        } else if rest.contains("day") {
            rest.split_whitespace().next()
                .and_then(|n| n.parse::<u64>().ok())
                .map(|n| n * 86400)
                .unwrap_or(0)
        } else {
            0
        }
    } else {
        0
    }
}

fn docker_status_to_health(status: &str) -> String {
    let lower = status.to_lowercase();
    if lower.contains("unhealthy") || lower.contains("exited") {
        "crashed".to_string()
    } else {
        "healthy".to_string()
    }
}
```

### 2.4 `scanner/mod.rs` -- The Orchestrator

**Responsibility:** Run all three scanners, merge results, resolve projects, deduplicate, and return `Vec<ProjectGroup>`.

```rust
use std::collections::HashSet;
use sysinfo::{System, ProcessesToUpdate, CpuRefreshKind, ProcessRefreshKind, RefreshKind};
use tokio::sync::Mutex;
use std::sync::Arc;
use crate::types::{ProcessInfo, ProjectGroup};
use crate::project_resolver;
use crate::errors::ScanError;

mod port_scanner;
mod dev_tools;
mod docker;

/// Shared System instance behind a Mutex.
/// sysinfo::System is not Send+Sync, so we wrap it.
pub struct Scanner {
    sys: Mutex<System>,
}

impl Scanner {
    pub fn new() -> Self {
        let mut sys = System::new();
        // Initial full refresh
        sys.refresh_processes(ProcessesToUpdate::All, true);
        Self {
            sys: Mutex::new(sys),
        }
    }

    /// Perform a full scan. Called every 5 seconds from the background task
    /// or on-demand via manual refresh.
    pub async fn scan(&self, projects_dir: &str) -> Result<Vec<ProjectGroup>, ScanError> {
        // Step 1: Refresh sysinfo (this is the expensive part)
        let (port_results, dev_results) = {
            let mut sys = self.sys.lock().await;
            sys.refresh_processes(ProcessesToUpdate::All, true);

            // Step 2: Run port scanner
            let port_results = port_scanner::scan_listening_ports(&sys)?;

            // Step 3: Run dev tool scanner, excluding PIDs already found
            let found_pids: HashSet<u32> = port_results.iter().map(|p| p.pid).collect();
            let dev_results = dev_tools::scan_dev_tools(&sys, &found_pids);

            (port_results, dev_results)
        };
        // Mutex released here -- docker scanning does not need sysinfo

        // Step 4: Run Docker scanner (async, independent)
        let docker_results = docker::scan_docker_containers().await?;

        // Step 5: Merge all results
        let mut all_processes: Vec<ProcessInfo> = Vec::new();
        all_processes.extend(port_results);
        all_processes.extend(dev_results);
        all_processes.extend(docker_results);

        // Step 6: Resolve project for each process
        let groups = project_resolver::group_by_project(all_processes, projects_dir);

        Ok(groups)
    }
}
```

**Performance note:** The sysinfo `Mutex` is held only during process enumeration and port/dev scanning, then released before the async Docker call. This keeps lock contention minimal.

---

## 3. Project Resolver

File: `src-tauri/src/project_resolver.rs`

### Algorithm

For each process, determine which project it belongs to:

```
Input:  process.cwd = "/Users/efe/Desktop/Projects/agent-attack/apps/web"
        projects_dir = "/Users/efe/Desktop/Projects"

1. Check if cwd starts with projects_dir
   -> YES: extract first path component after projects_dir
   -> project_name = "agent-attack"
   -> relative_path = "/apps/web"

2. If cwd does NOT start with projects_dir:
   Walk UP from cwd looking for project markers:
     .git, package.json, Cargo.toml, go.mod, pyproject.toml

   If marker found at /some/path/my-project/:
     -> project_name = "my-project"
     -> relative_path = remaining subpath

3. For Docker containers:
   Check compose_workdir label first.
   If that starts with projects_dir, same logic as step 1.
   Fall back to container_name matching against known project folder names.
   Last resort: group under "Docker".

4. If nothing matches: group under "Other".
```

### Implementation

```rust
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use crate::types::{ProcessInfo, ProjectGroup};

const PROJECT_MARKERS: &[&str] = &[
    ".git",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
    "requirements.txt",
    "Gemfile",
    "pom.xml",
    "build.gradle",
    "mix.exs",          // Elixir
    "Makefile",
];

/// Resolve a cwd to (project_name, project_root_path, relative_path).
fn resolve_project(cwd: &str, projects_dir: &str) -> (String, String, String) {
    if cwd.is_empty() {
        return ("Other".to_string(), String::new(), String::new());
    }

    let cwd_path = Path::new(cwd);

    // Strategy 1: Check if cwd is under projects_dir
    if let Ok(relative) = cwd_path.strip_prefix(projects_dir) {
        let components: Vec<&str> = relative
            .components()
            .map(|c| c.as_os_str().to_str().unwrap_or(""))
            .collect();

        if let Some(project_name) = components.first() {
            if !project_name.is_empty() {
                let project_root = format!("{}/{}", projects_dir, project_name);
                let sub_path = if components.len() > 1 {
                    format!("/{}", components[1..].join("/"))
                } else {
                    String::new()
                };
                return (project_name.to_string(), project_root, sub_path);
            }
        }
    }

    // Strategy 2: Walk up directory tree looking for project markers
    let mut current = cwd_path.to_path_buf();
    loop {
        for marker in PROJECT_MARKERS {
            if current.join(marker).exists() {
                let project_name = current
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Unknown".to_string());
                let project_root = current.to_string_lossy().to_string();
                let relative = cwd_path
                    .strip_prefix(&current)
                    .map(|r| {
                        let s = r.to_string_lossy().to_string();
                        if s.is_empty() { s } else { format!("/{}", s) }
                    })
                    .unwrap_or_default();
                return (project_name, project_root, relative);
            }
        }
        if !current.pop() {
            break;
        }
        // Stop at home directory -- don't walk into / or /Users
        if current.components().count() <= 2 {
            break;
        }
    }

    // Strategy 3: Fall back to parent directory name
    let parent_name = cwd_path
        .parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Other".to_string());

    (parent_name, cwd.to_string(), String::new())
}

/// Group a flat list of ProcessInfo into ProjectGroups.
pub fn group_by_project(
    mut processes: Vec<ProcessInfo>,
    projects_dir: &str,
) -> Vec<ProjectGroup> {
    let mut groups: HashMap<String, ProjectGroup> = HashMap::new();

    for mut process in processes {
        let (project_name, project_path, relative_path) =
            resolve_project(&process.cwd, projects_dir);

        process.relative_path = relative_path;

        groups
            .entry(project_name.clone())
            .or_insert_with(|| ProjectGroup {
                name: project_name,
                path: project_path,
                processes: Vec::new(),
            })
            .processes
            .push(process);
    }

    // Sort: projects with ports first, then alphabetically
    let mut result: Vec<ProjectGroup> = groups.into_values().collect();
    result.sort_by(|a, b| {
        let a_has_ports = a.processes.iter().any(|p| p.port.is_some());
        let b_has_ports = b.processes.iter().any(|p| p.port.is_some());
        b_has_ports.cmp(&a_has_ports).then(a.name.cmp(&b.name))
    });

    // Sort processes within each group by port number
    for group in &mut result {
        group.processes.sort_by_key(|p| p.port.unwrap_or(u16::MAX));
    }

    result
}
```

### Edge cases handled

| Scenario | Resolution |
|----------|-----------|
| `cwd` is empty (kernel process, zombie) | Grouped under "Other" |
| Process cwd is `/Users/efe/Desktop/Projects/agent-attack/apps/web` | `agent-attack`, relative: `/apps/web` |
| Process cwd is `/opt/homebrew/var/postgres` | Walk up finds nothing; groups under "var" or "Other" |
| Docker container with compose label pointing to projects dir | Same as native process resolution |
| Docker container with no compose labels | Groups under "Docker" |
| Multiple processes same PID different ports | Each gets its own `ProcessInfo` entry, same project group |

---

## 4. Tauri Commands

File: `src-tauri/src/commands.rs`

### Error Handling Strategy

All commands return `Result<T, String>`. Tauri serializes `Err(String)` as a rejected promise on the frontend. We use a helper to convert our internal `ScanError` into a user-friendly string.

```rust
use tauri::{AppHandle, Manager, State};
use std::sync::Arc;
use crate::scanner::Scanner;
use crate::types::{ProjectGroup, Settings};
use crate::errors::ScanError;

/// Convert ScanError to a user-facing string for the frontend.
fn to_cmd_error(e: ScanError) -> String {
    format!("{}", e)
}
```

### Command signatures

```rust
/// Main scanning command. Called every 5 seconds by the frontend poller
/// and on-demand for manual refresh.
#[tauri::command]
pub async fn get_processes(
    scanner: State<'_, Arc<Scanner>>,
    projects_dir: String,
) -> Result<Vec<ProjectGroup>, String> {
    scanner.scan(&projects_dir).await.map_err(to_cmd_error)
}

/// Kill a native process by PID. Sends SIGTERM, not SIGKILL.
#[tauri::command]
pub async fn stop_process(pid: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::process::Command;
        Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to stop process {}: {}", pid, e))?;
    }
    Ok(())
}

/// Restart a process: kill it and re-launch from its original cwd + command.
/// NOTE: True restart requires knowing the original command. For MVP,
/// this just kills the process. The dev's file watcher (nodemon, cargo-watch)
/// will restart it automatically.
#[tauri::command]
pub async fn restart_process(pid: u32) -> Result<(), String> {
    // For MVP, restart = stop. Most dev tools auto-restart.
    stop_process(pid).await
}

/// Open a directory in the default terminal (Terminal.app / iTerm2).
#[tauri::command]
pub async fn open_in_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Terminal", &path])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }
    Ok(())
}

/// Open a directory in the user's preferred editor.
#[tauri::command]
pub async fn open_in_editor(path: String, editor: String) -> Result<(), String> {
    let cmd = match editor.as_str() {
        "cursor" => "cursor",
        "code" | "vscode" => "code",
        "zed" => "zed",
        "subl" | "sublime" => "subl",
        other => other,
    };

    std::process::Command::new(cmd)
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open {} with {}: {}", path, editor, e))?;

    Ok(())
}

/// Open http://localhost:{port} in the default browser.
#[tauri::command]
pub async fn open_in_browser(port: u16) -> Result<(), String> {
    let url = format!("http://localhost:{}", port);
    open::that(&url).map_err(|e| format!("Failed to open browser: {}", e))
}

/// Stop a Docker container by ID.
#[tauri::command]
pub async fn stop_docker_container(container_id: String) -> Result<(), String> {
    use bollard::Docker;
    use bollard::container::StopContainerOptions;

    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Docker connection failed: {}", e))?;

    docker
        .stop_container(&container_id, Some(StopContainerOptions { t: 10 }))
        .await
        .map_err(|e| format!("Failed to stop container: {}", e))
}

/// Restart a Docker container by ID.
#[tauri::command]
pub async fn restart_docker_container(container_id: String) -> Result<(), String> {
    use bollard::Docker;
    use bollard::container::RestartContainerOptions;

    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Docker connection failed: {}", e))?;

    docker
        .restart_container(&container_id, Some(RestartContainerOptions { t: 10 }))
        .await
        .map_err(|e| format!("Failed to restart container: {}", e))
}

/// Load settings from tauri-plugin-store.
#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<Settings, String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("settings.json")
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    let settings = Settings {
        scan_interval: store.get("scan_interval")
            .and_then(|v| v.as_u64())
            .unwrap_or(5000) as u32,
        projects_dir: store.get("projects_dir")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| {
                dirs::home_dir()
                    .map(|h| format!("{}/Desktop/Projects", h.display()))
                    .unwrap_or_default()
            }),
        theme: store.get("theme")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "system".to_string()),
        editor_command: store.get("editor_command")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "cursor".to_string()),
    };

    Ok(settings)
}

/// Save settings to tauri-plugin-store.
#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("settings.json")
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    store.set("scan_interval", serde_json::json!(settings.scan_interval));
    store.set("projects_dir", serde_json::json!(settings.projects_dir));
    store.set("theme", serde_json::json!(settings.theme));
    store.set("editor_command", serde_json::json!(settings.editor_command));

    store.save().map_err(|e| format!("Failed to save settings: {}", e))
}
```

**Note on `open_in_browser`:** Add the `open` crate (`open = "5"`) to Cargo.toml dependencies. It handles cross-platform "open URL in default browser" cleanly.

---

## 5. Tray Icon Setup (lib.rs)

Directly adapted from the voice-prompt `lib.rs` pattern, with localhost-specific changes.

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, PhysicalPosition,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use std::sync::Arc;

mod commands;
mod errors;
mod project_resolver;
mod scanner;
mod types;

use scanner::Scanner;

#[cfg(target_os = "macos")]
use cocoa::appkit::{NSApp, NSApplication};
#[cfg(target_os = "macos")]
use cocoa::base::YES;
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl, runtime::Object};

// ---- macOS window constants (identical to voice-prompt) ----
#[cfg(target_os = "macos")]
const NS_WINDOW_COLLECTION_BEHAVIOR_CAN_JOIN_ALL_SPACES: u64 = 1 << 0;
#[cfg(target_os = "macos")]
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_AUXILIARY: u64 = 1 << 8;
#[cfg(target_os = "macos")]
const NS_WINDOW_COLLECTION_BEHAVIOR_STATIONARY: u64 = 1 << 4;
#[cfg(target_os = "macos")]
const NS_POPUP_MENU_WINDOW_LEVEL: i64 = 101;

#[cfg(target_os = "macos")]
fn configure_macos_window(window: &tauri::WebviewWindow) {
    unsafe {
        let ns_window = window.ns_window();
        if let Ok(ns_win) = ns_window {
            let ns_win = ns_win as *mut Object;
            let behavior: u64 = NS_WINDOW_COLLECTION_BEHAVIOR_CAN_JOIN_ALL_SPACES
                | NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_AUXILIARY
                | NS_WINDOW_COLLECTION_BEHAVIOR_STATIONARY;
            let _: () = msg_send![ns_win, setCollectionBehavior: behavior];
            let _: () = msg_send![ns_win, setLevel: NS_POPUP_MENU_WINDOW_LEVEL];
        }
    }
}

fn show_window_at_position(
    _app: &AppHandle,
    window: &tauri::WebviewWindow,
    x: f64,
    y: f64,
) {
    #[cfg(target_os = "macos")]
    configure_macos_window(window);

    let _ = window.set_position(PhysicalPosition::new(x as i32, y as i32));
    let _ = window.show();
    let _ = window.set_focus();

    #[cfg(target_os = "macos")]
    {
        unsafe {
            let ns_app = NSApp();
            ns_app.activateIgnoringOtherApps_(YES);
        }
    }
}

pub fn run() {
    // Create the Scanner and wrap in Arc for sharing with Tauri state
    let scanner = Arc::new(Scanner::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(scanner)
        .setup(|app| {
            // --- Tray menu ---
            let refresh_item = MenuItem::with_id(app, "refresh", "Refresh Now", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit localhost", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&refresh_item, &quit_item])?;

            // --- Tray icon ---
            // MVP: use a text-based "://" icon. For production, replace with
            // a proper template PNG at icons/macos/tray-icon@2x.png.
            #[cfg(target_os = "macos")]
            let tray_icon = tauri::image::Image::from_bytes(
                include_bytes!("../icons/macos/tray-icon@2x.png")
            ).expect("Failed to load tray icon");

            #[cfg(not(target_os = "macos"))]
            let tray_icon = tauri::image::Image::from_bytes(
                include_bytes!("../icons/shared/32x32.png")
            ).expect("Failed to load tray icon");

            let mut tray_builder = TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("localhost");

            #[cfg(target_os = "macos")]
            {
                tray_builder = tray_builder.icon_as_template(true);
            }

            let _tray = tray_builder
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "refresh" => {
                            // Emit event to frontend to trigger immediate scan
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("force-refresh", ());
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        position,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let width = 360.0;
                                let x = (position.x - width / 2.0).max(0.0);
                                let y = position.y + 5.0;
                                show_window_at_position(&app, &window, x, y);
                            }
                        }
                    }
                })
                .build(app)?;

            // Hide from dock on macOS (menu-bar-only app)
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_processes,
            commands::stop_process,
            commands::restart_process,
            commands::open_in_terminal,
            commands::open_in_editor,
            commands::open_in_browser,
            commands::stop_docker_container,
            commands::restart_docker_container,
            commands::get_settings,
            commands::save_settings,
        ])
        .on_window_event(|window, event| {
            // Hide window on focus lost (click-outside-to-dismiss behavior)
            if let tauri::WindowEvent::Focused(false) = event {
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Key differences from voice-prompt

| Aspect | voice-prompt | localhost |
|--------|-------------|-----------|
| Close behavior | Confirm dialog, then hide | Hide on focus loss (no confirm) |
| Tray right-click menu | "Quit" only | "Refresh Now" + "Quit" |
| State management | None | `Arc<Scanner>` managed via `.manage()` |
| Dock visibility | Hidden (Accessory) | Hidden (Accessory) -- same |
| Window dismiss | Click tray to toggle | Click tray to toggle + focus-loss hide |

The focus-loss auto-hide (`WindowEvent::Focused(false)`) is important for localhost because it behaves like a native macOS menu bar dropdown. When the user clicks elsewhere, the panel disappears.

---

## 6. Performance Considerations

### 6.1 Scan cycle budget

Target: complete a full scan in <200ms so the 5-second interval feels responsive without overlap.

| Operation | Expected time | Strategy |
|-----------|--------------|----------|
| `sysinfo::refresh_processes` | ~50-100ms | Refresh all processes; no way to do incremental with sysinfo |
| `netstat2::get_sockets_info` | ~10-20ms | Single syscall, very fast |
| `bollard::list_containers` | ~20-50ms | Local Unix socket, no network |
| Project resolution (file exists checks) | ~5-10ms | Only walks up ~5 levels per process |
| Merge + sort | <1ms | In-memory |

Total: ~100-200ms per scan cycle. Leaves ~4.8 seconds of idle time between scans.

### 6.2 Non-blocking UI architecture

The frontend calls `invoke("get_processes")` on a 5-second `setInterval`. The Tauri command is `async` and runs on the tokio thread pool, not the main thread. The UI thread is never blocked.

```
Main thread (UI)          Tokio pool
    |                         |
    |-- invoke("get_processes") -->
    |                         |-- sysinfo refresh
    |   (UI responsive)       |-- netstat2 scan
    |                         |-- bollard query
    |                         |-- project_resolver
    | <-- Result<Vec<ProjectGroup>> --
    |-- update Zustand store
    |-- React re-render
```

### 6.3 Efficient diffing

The frontend should diff the new `Vec<ProjectGroup>` against the previous state and only re-render if something changed. Strategy:

- Compute a hash/fingerprint of each scan result (sorted PIDs + ports).
- Compare fingerprint before calling `setState`. If identical, skip the update.
- This prevents React re-renders when nothing has changed (which is the common case -- most 5-second intervals produce identical results).

### 6.4 sysinfo reuse

The `Scanner` struct holds a persistent `System` instance behind a `Mutex`. Calling `refresh_processes` on an existing `System` is faster than creating a new one each time because sysinfo reuses internal caches.

### 6.5 Memory usage

Expected steady-state: ~15-25 MB RSS.

- sysinfo process cache: ~5-10 MB
- Bollard client: ~2 MB
- Tauri + webview: ~10 MB
- Scan result serialization: <100 KB per cycle

### 6.6 Battery / CPU impact

- 5-second polling with ~150ms of work = ~3% duty cycle.
- sysinfo does not use polling internally; it reads `/proc` (Linux) or uses `sysctl` (macOS) which are instantaneous kernel calls.
- Consider increasing the interval to 10 seconds when on battery power (future enhancement).

---

## 7. Platform-Specific Code

### 7.1 macOS window management (required for MVP)

Already covered in section 5. The key macOS-specific behaviors:

1. **Dock hiding:** `app.set_activation_policy(tauri::ActivationPolicy::Accessory)` -- the app does not appear in the Dock or Cmd+Tab switcher.

2. **Window level:** Set to `NS_POPUP_MENU_WINDOW_LEVEL` (101) so the dropdown appears above all other windows, including fullscreen apps.

3. **Collection behavior:** `CAN_JOIN_ALL_SPACES | FULL_SCREEN_AUXILIARY | STATIONARY` ensures the window appears on every Space/Desktop and does not get hidden when switching Spaces.

4. **Activation:** `NSApp().activateIgnoringOtherApps_(YES)` brings the app's windows to front even when it was not the frontmost app.

### 7.2 macOS process scanning specifics

- `sysinfo` on macOS uses `sysctl` and `proc_pidinfo` under the hood. No special permissions needed for reading process info of processes owned by the current user.
- **Important:** Reading `cwd` of processes not owned by the current user requires root. Since dev processes are always user-owned, this is not a problem. We silently skip processes where `cwd` returns `None`.
- Docker socket at `/var/run/docker.sock` requires the user to be in the `docker` group or Docker Desktop to be installed (which handles permissions automatically).

### 7.3 Process termination

On macOS/Unix, `kill -TERM <pid>` sends SIGTERM. We use `std::process::Command` rather than the `nix` crate to keep dependencies minimal. The `kill` command is universally available.

Future enhancement: send SIGKILL if the process does not exit within 5 seconds of SIGTERM.

### 7.4 Opening applications

- `open -a Terminal <path>` -- opens Terminal.app at the given directory.
- `cursor <path>` / `code <path>` -- opens the editor. These commands are available if the user has installed them to PATH (Cursor and VS Code both offer "Install 'cursor'/'code' command in PATH" options).

### 7.5 Entitlements (entitlements.plist)

The app needs network access (for Docker socket) and potentially accessibility access (none needed for MVP).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

**App Sandbox is disabled** because sandboxed apps cannot read other processes' info or access the Docker socket. This is standard for developer tools distributed outside the Mac App Store.

---

## 8. Error Types

File: `src-tauri/src/errors.rs`

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ScanError {
    #[error("Failed to scan network ports: {0}")]
    NetstatError(String),

    #[error("Docker error: {0}")]
    DockerError(String),

    #[error("Process error: {0}")]
    ProcessError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}
```

---

## 9. Data Types

File: `src-tauri/src/types.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub port: Option<u16>,
    pub cwd: String,
    pub relative_path: String,
    pub uptime_secs: u64,
    pub cpu_percent: f32,
    pub memory_mb: u64,
    pub status: String,
    pub source: String,
    pub docker_info: Option<DockerContainerInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerContainerInfo {
    pub container_id: String,
    pub container_name: String,
    pub image: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectGroup {
    pub name: String,
    pub path: String,
    pub processes: Vec<ProcessInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub scan_interval: u32,
    pub projects_dir: String,
    pub theme: String,
    pub editor_command: String,
}
```

---

## 10. Step-by-Step Implementation Order

### Phase 1: Skeleton (Day 1)

**Goal:** Tauri app compiles, shows tray icon, dropdown toggles on click, hides from dock.

1. Initialize the Tauri project: `pnpm create tauri-app localhost`
2. Create `src-tauri/src/types.rs` with all structs.
3. Create `src-tauri/src/errors.rs` with the `ScanError` enum.
4. Create `src-tauri/src/lib.rs` with tray icon setup (copy from section 5, strip scanner references temporarily).
5. Create `src-tauri/src/main.rs` with `fn main() { localhost_lib::run() }`.
6. Update `Cargo.toml` with all dependencies.
7. Create a placeholder tray icon PNG (even a 1x1 pixel is fine for now).
8. Verify: `pnpm tauri dev` shows a tray icon, left-click toggles a blank window below it, focus loss hides it, right-click shows "Quit".

**Files created:** `types.rs`, `errors.rs`, `lib.rs`, `main.rs`, `Cargo.toml`

### Phase 2: Port Scanner (Day 2)

**Goal:** Detect all processes listening on TCP ports and display them in the frontend.

1. Create `src-tauri/src/scanner/mod.rs` with the `Scanner` struct.
2. Create `src-tauri/src/scanner/port_scanner.rs` with `scan_listening_ports()`.
3. Create `src-tauri/src/project_resolver.rs` with a simplified version (just the `projects_dir` prefix check).
4. Create `src-tauri/src/commands.rs` with `get_processes` only.
5. Wire up `Scanner` as managed state in `lib.rs`.
6. Register `get_processes` in the `invoke_handler`.
7. Frontend: create a minimal React component that calls `invoke("get_processes")` and renders the raw JSON.
8. Verify: start a local dev server (e.g., `python -m http.server 8000`), open localhost app, see it detected.

**Files created:** `scanner/mod.rs`, `scanner/port_scanner.rs`, `project_resolver.rs`, `commands.rs`

### Phase 3: Dev Tools Scanner (Day 2-3)

**Goal:** Also detect dev processes that are not listening on ports.

1. Create `src-tauri/src/scanner/dev_tools.rs`.
2. Integrate into `scanner/mod.rs` orchestrator.
3. Verify: run `cargo build` in a project, see it appear in the list without a port.

**Files created:** `scanner/dev_tools.rs`

### Phase 4: Docker Scanner (Day 3)

**Goal:** Detect Docker containers with port mappings and compose labels.

1. Create `src-tauri/src/scanner/docker.rs`.
2. Integrate into `scanner/mod.rs` orchestrator.
3. Verify: start a `docker run -p 5432:5432 postgres` container, see it grouped correctly.

**Files created:** `scanner/docker.rs`

### Phase 5: Project Resolver (Day 3-4)

**Goal:** Full project resolution with directory tree walking.

1. Expand `project_resolver.rs` with the full walk-up algorithm.
2. Add the "Docker" and "Other" fallback groups.
3. Test with processes running in nested subdirectories.
4. Verify: a process in `~/Desktop/Projects/agent-attack/apps/web` correctly resolves to project "agent-attack" with relative path "/apps/web".

### Phase 6: Process Actions (Day 4)

**Goal:** Stop, restart, open in terminal/editor/browser.

1. Implement remaining commands in `commands.rs`: `stop_process`, `restart_process`, `open_in_terminal`, `open_in_editor`, `open_in_browser`.
2. Implement Docker commands: `stop_docker_container`, `restart_docker_container`.
3. Add the `open` crate dependency for browser opening.
4. Wire all commands into `invoke_handler`.
5. Verify each action works from the frontend detail panel.

### Phase 7: Settings (Day 4-5)

**Goal:** Persist and load user preferences.

1. Implement `get_settings` and `save_settings` commands.
2. Frontend: settings panel with projects_dir, scan_interval, editor, theme.
3. Verify: change settings, quit app, reopen, settings persist.

### Phase 8: Polish and Edge Cases (Day 5)

1. Add port filtering (skip system ports like 5000/AirPlay).
2. Add process name filtering (skip system daemons).
3. Handle Docker not installed/not running gracefully.
4. Handle processes that disappear between scan and action (race condition -- just return a friendly error).
5. Test with 0 processes (empty state), 1 process, 50+ processes (scrolling).
6. Verify memory usage stays under 30 MB.
7. Run `cargo clippy -- -W clippy::pedantic` and fix all warnings.
8. Add doc comments to all public functions.

### Phase 9: Distribution (Day 6)

1. Create tray icon assets (proper `://` rendered as a template PNG).
2. Set up `tauri.conf.json` with correct bundle identifiers, window config (360px width, decorations: false, visible: false on start).
3. Create GitHub Actions workflow for macOS release.
4. Test DMG installation on a clean machine.

---

## Appendix A: tauri.conf.json Window Configuration

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "localhost",
        "width": 360,
        "height": 500,
        "resizable": false,
        "decorations": false,
        "visible": false,
        "skipTaskbar": true,
        "transparent": true,
        "alwaysOnTop": true
      }
    ]
  }
}
```

Key settings:
- `visible: false` -- window starts hidden; tray click reveals it.
- `decorations: false` -- no title bar; the React UI handles its own header.
- `skipTaskbar: true` -- does not appear in Cmd+Tab.
- `transparent: true` -- allows rounded corners via CSS `border-radius`.

## Appendix B: Complete Dependency List

| Crate | Version | Required by |
|-------|---------|-------------|
| `tauri` | 2.x | Framework |
| `tauri-build` | 2.x | Build script |
| `tauri-plugin-shell` | 2.x | Opening terminal/editor |
| `tauri-plugin-dialog` | 2.x | Quit confirmation |
| `tauri-plugin-store` | 2.x | Settings persistence |
| `serde` | 1.x | Serialization |
| `serde_json` | 1.x | JSON conversion |
| `tokio` | 1.x | Async runtime for bollard |
| `sysinfo` | 0.33 | Process info |
| `bollard` | 0.18 | Docker API |
| `netstat2` | 0.9 | Port-to-PID mapping |
| `thiserror` | 2.x | Error types |
| `dirs` | 6.x | Home directory |
| `open` | 5.x | Open URLs in browser |
| `log` | 0.4 | Logging facade |
| `env_logger` | 0.11 | Logging backend |
| `cocoa` | 0.26 | macOS window APIs |
| `objc` | 0.2 | macOS Objective-C bridge |

Total: 18 direct dependencies. Bollard and sysinfo are the heaviest; everything else is lightweight.
