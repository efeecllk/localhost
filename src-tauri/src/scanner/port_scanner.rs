use std::collections::HashMap;

use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use sysinfo::{Pid, System};

use crate::errors::ScanError;
use crate::types::ProcessInfo;

/// System ports to ignore (not dev servers).
const IGNORED_PORTS: &[u16] = &[
    22,   // SSH
    53,   // DNS
    80,   // system httpd (not dev)
    443,  // system httpd (not dev)
    631,  // CUPS printing
    5000, // macOS AirPlay receiver (Monterey+)
    7000, // macOS AirPlay
];

/// System processes to ignore.
const IGNORED_PROCESSES: &[&str] = &[
    "rapportd",
    "ControlCenter",
    "sharingd",
    "WiFiAgent",
    "AirPlayXPCHelper",
];

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
                // Skip ignored ports
                if IGNORED_PORTS.contains(&tcp.local_port) {
                    continue;
                }
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
            let name = process.name().to_string_lossy().to_string();

            // Skip ignored system processes
            if IGNORED_PROCESSES.iter().any(|&ignored| name == ignored) {
                continue;
            }

            let cwd = process
                .cwd()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
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
