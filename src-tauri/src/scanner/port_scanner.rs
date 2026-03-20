// src-tauri/src/scanner/port_scanner.rs
// Detects processes listening on TCP ports using netstat2 and enriches them with sysinfo data.

use std::collections::{HashMap, HashSet};

use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use sysinfo::{Pid, System};

use crate::errors::ScanError;
use crate::proc_cwd;
use crate::types::ProcessInfo;

/// System ports to ignore (not dev servers).
const IGNORED_PORTS: &[u16] = &[
    22,   // SSH
    53,   // DNS
    80,   // system httpd (not dev)
    443,  // system httpd (not dev)
    631,  // CUPS printing (Unix)
    5000, // macOS AirPlay receiver (Monterey+)
    5040, // Windows RPC
    5357, // Windows WSDAPI
    7000, // macOS AirPlay
    7680, // Windows Update Delivery Optimization
];

/// System and non-dev processes to ignore.
const IGNORED_PROCESSES: &[&str] = &[
    // macOS system
    "rapportd",
    "ControlCenter",
    "sharingd",
    "WiFiAgent",
    "AirPlayXPCHelper",
    "launchd",
    "mDNSResponder",
    "SystemUIServer",
    "WindowServer",
    "loginwindow",
    "syslogd",
    "UserEventAgent",
    "coreservicesd",
    "backupd",
    "Finder",
    "Dock",
    "NotificationCenter",
    // Desktop apps (not dev servers)
    "Spotify",
    "Slack",
    "Discord",
    "zoom.us",
    "Microsoft Teams",
    "Google Chrome",
    "Safari",
    "Firefox",
    "Arc",
    "Brave Browser",
    "Signal",
    "Telegram",
    "WhatsApp",
    "Figma",
    "Notion",
    "Obsidian",
    "1Password",
    "iTerm2",
    "Terminal",
    "Warp",
    "Alacritty",
    "kitty",
    "Mail",
    "Calendar",
    "Messages",
    "Music",
    "Photos",
    "Preview",
    "Keynote",
    "Pages",
    "Numbers",
    "Loom",
    "CleanMyMac",
    "Alfred",
    "Raycast",
    "Bartender",
    "Amphetamine",
    // System services that listen on ports
    "postgres",
    "Postgres",
    "PostgreSQL",
    "mysqld",
    "mongod",
    "redis-server",
    "nginx",
    "httpd",
    // macOS system services
    "Notes",
    "FHC",
    "Clip Proxy API",
    "clipProxyAPI",
    "com.apple.WebKit",
    "nesessionmanager",
    "remindd",
    "cloudd",
    "identityservicesd",
    "imagent",
    "apsd",
    // Windows system services
    "svchost.exe",
    "System",
    "lsass.exe",
    "services.exe",
    "wininit.exe",
    "spoolsv.exe",
    "SearchIndexer.exe",
    "SecurityHealthService.exe",
    "MsMpEng.exe",
    "WmiPrvSE.exe",
    "dasHost.exe",
    "sihost.exe",
    "explorer.exe",
    "taskhostw.exe",
    "RuntimeBroker.exe",
    "ShellExperienceHost.exe",
    "StartMenuExperienceHost.exe",
    "ctfmon.exe",
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

/// Compute a simple health status string based on CPU and memory usage.
fn compute_health(cpu_percent: f32, memory_mb: u64) -> String {
    if cpu_percent > 90.0 {
        "high_cpu".to_string()
    } else if memory_mb > 1024 {
        "high_memory".to_string()
    } else {
        "healthy".to_string()
    }
}

/// Build a map of PID -> Vec<port> from netstat2,
/// then enrich each with sysinfo process data.
/// Only includes processes whose cwd is under `projects_dir`.
pub fn scan_listening_ports(sys: &System, projects_dir: &str) -> Result<Vec<ProcessInfo>, ScanError> {
    let expanded_dir = expand_projects_dir(projects_dir);
    // Step 1: Get all TCP sockets in LISTEN state
    let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto_flags = ProtocolFlags::TCP;
    let sockets = get_sockets_info(af_flags, proto_flags)
        .map_err(|e| ScanError::NetstatError(e.to_string()))?;

    // Step 2: Build PID -> ports mapping, filtering to LISTEN only.
    // Use a HashSet per PID to deduplicate IPv4/IPv6 listeners on the same port.
    let mut pid_ports: HashMap<u32, HashSet<u16>> = HashMap::new();
    for socket in &sockets {
        if let ProtocolSocketInfo::Tcp(tcp) = &socket.protocol_socket_info {
            if tcp.state == netstat2::TcpState::Listen {
                // Skip ignored ports
                if IGNORED_PORTS.contains(&tcp.local_port) {
                    continue;
                }
                for pid in &socket.associated_pids {
                    pid_ports.entry(*pid).or_default().insert(tcp.local_port);
                }
            }
        }
    }

    // Step 3: For each PID with listening ports, pull sysinfo data
    let mut results = Vec::new();
    for (pid, ports) in &pid_ports {
        if let Some(process) = sys.process(Pid::from_u32(*pid)) {
            let name = process.name().to_string_lossy().to_string();

            // Skip ignored system processes.
            // On Windows, sysinfo returns names with .exe suffix — match both forms.
            let match_name = name.strip_suffix(".exe").unwrap_or(&name);
            if IGNORED_PROCESSES.iter().any(|&ignored| name == ignored || match_name == ignored) {
                continue;
            }

            let cwd = proc_cwd::get_cwd(*pid, process);

            // Skip processes whose cwd is not under projects_dir
            if cwd.is_empty() || !cwd.starts_with(&expanded_dir) {
                continue;
            }

            let uptime_secs = process.run_time();
            let cpu_percent = process.cpu_usage();
            let memory_mb = process.memory() / (1024 * 1024);

            // Create one ProcessInfo per port
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
