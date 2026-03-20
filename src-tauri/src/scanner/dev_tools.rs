// src-tauri/src/scanner/dev_tools.rs
// Detects running processes matching known dev tool names (node, python, cargo, etc.).

use std::collections::HashSet;

use sysinfo::System;

use crate::proc_cwd;
use crate::types::ProcessInfo;

/// Known dev tool process names grouped by ecosystem.
const DEV_TOOL_NAMES: &[&str] = &[
    // JavaScript / Node
    "node",
    "deno",
    "bun",
    "tsx",
    "ts-node",
    "npx",
    // Python
    "python",
    "python3",
    "uvicorn",
    "gunicorn",
    "flask",
    "django",
    "celery",
    "pytest",
    "mypy",
    // Go
    "go",
    "air",
    "dlv",
    // Rust
    "cargo",
    "rustc",
    "rust-analyzer",
    // Ruby
    "ruby",
    "rails",
    "puma",
    "sidekiq",
    "bundle",
    // Java / JVM
    "java",
    "gradle",
    "mvn",
    "kotlin",
    // Databases (native, not Docker)
    "mysqld",
    "mongod",
    "redis-server",
    "redis-cli",
    // Servers
    "nginx",
    "caddy",
    "httpd",
    // Build tools
    "webpack",
    "vite",
    "esbuild",
    "turbo",
    "nx",
];

/// Expand ~ to the user's home directory.
fn expand_projects_dir(path: &str) -> String {
    if path.starts_with("~/") || path == "~" {
        if let Some(home) = dirs::home_dir() {
            return path.replacen('~', &home.to_string_lossy(), 1);
        }
    }
    path.to_string()
}

/// Scan for running processes whose names match known dev tools,
/// excluding any PIDs already captured by the port scanner.
/// Only includes processes whose cwd is under `projects_dir`.
pub fn scan_dev_tools(sys: &System, already_found_pids: &HashSet<u32>, projects_dir: &str) -> Vec<ProcessInfo> {
    let tool_set: HashSet<&str> = DEV_TOOL_NAMES.iter().copied().collect();
    let expanded_dir = expand_projects_dir(projects_dir);
    let mut results = Vec::new();

    for (pid, process) in sys.processes() {
        let pid_u32 = pid.as_u32();
        // Skip if port_scanner already captured this PID
        if already_found_pids.contains(&pid_u32) {
            continue;
        }

        let name = process.name().to_string_lossy().to_string();
        // On Windows, sysinfo returns names with .exe suffix — strip it for matching
        let match_name = name.strip_suffix(".exe").unwrap_or(&name);
        if tool_set.contains(match_name) {
            let cwd = proc_cwd::get_cwd(pid_u32, process);

            // Skip processes whose cwd is not under projects_dir
            if cwd.is_empty() || !cwd.starts_with(&expanded_dir) {
                continue;
            }

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
