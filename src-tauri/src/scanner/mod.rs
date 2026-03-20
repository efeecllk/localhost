use std::collections::HashSet;
use sysinfo::{ProcessesToUpdate, System};
use tokio::sync::Mutex;

use crate::errors::ScanError;
use crate::project_resolver;
use crate::types::ProjectGroup;

pub mod dev_tools;
pub mod docker;
pub mod port_scanner;

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

    /// Perform a full scan. Called every 5 seconds from the frontend poller
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
        let mut all_processes = Vec::new();
        all_processes.extend(port_results);
        all_processes.extend(dev_results);
        all_processes.extend(docker_results);

        // Step 6: Resolve project for each process
        let groups = project_resolver::group_by_project(all_processes, projects_dir);

        Ok(groups)
    }
}
