use std::collections::HashSet;

use sysinfo::System;

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
    "postgres",
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

/// Scan for running processes whose names match known dev tools,
/// excluding any PIDs already captured by the port scanner.
pub fn scan_dev_tools(sys: &System, already_found_pids: &HashSet<u32>) -> Vec<ProcessInfo> {
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
            let cwd = process
                .cwd()
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
