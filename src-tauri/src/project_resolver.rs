use std::collections::HashMap;
use std::path::Path;

use crate::types::{ProcessInfo, ProjectGroup};

/// Expand ~ to the user's home directory.
fn expand_tilde(path: &str) -> String {
    if path.starts_with("~/") || path == "~" {
        if let Some(home) = dirs::home_dir() {
            return path.replacen('~', &home.to_string_lossy(), 1);
        }
    }
    path.to_string()
}

/// Resolve a cwd to (project_name, project_root_path, relative_path).
/// Returns None if the cwd is not under projects_dir.
fn resolve_project(cwd: &str, projects_dir: &str) -> Option<(String, String, String)> {
    if cwd.is_empty() {
        return None;
    }

    let cwd_path = Path::new(cwd);
    let expanded_dir = expand_tilde(projects_dir);

    // Only resolve if cwd is under projects_dir
    if let Ok(relative) = cwd_path.strip_prefix(&expanded_dir) {
        let components: Vec<&str> = relative
            .components()
            .map(|c| c.as_os_str().to_str().unwrap_or(""))
            .collect();

        if let Some(project_name) = components.first() {
            if !project_name.is_empty() {
                let project_root = format!("{}/{}", expanded_dir, project_name);
                let sub_path = if components.len() > 1 {
                    format!("/{}", components[1..].join("/"))
                } else {
                    String::new()
                };
                return Some((project_name.to_string(), project_root, sub_path));
            }
        }
    }

    // cwd is not under projects_dir — drop it
    None
}

/// Group a flat list of ProcessInfo into ProjectGroups.
/// Only includes processes whose cwd is under projects_dir or Docker containers.
pub fn group_by_project(processes: Vec<ProcessInfo>, projects_dir: &str) -> Vec<ProjectGroup> {
    let mut groups: HashMap<String, ProjectGroup> = HashMap::new();
    let expanded_dir = expand_tilde(projects_dir);

    for mut process in processes {
        // Docker containers: only include if cwd is under projects_dir
        if process.source == "docker" {
            if !process.cwd.is_empty() && process.cwd.starts_with(&expanded_dir) {
                if let Some((project_name, project_path, relative_path)) =
                    resolve_project(&process.cwd, projects_dir)
                {
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
            }
            continue;
        }

        // Non-docker: cwd MUST be under projects_dir, no exceptions
        if process.cwd.is_empty() || !process.cwd.starts_with(&expanded_dir) {
            continue;
        }

        if let Some((project_name, project_path, relative_path)) =
            resolve_project(&process.cwd, projects_dir)
        {
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
