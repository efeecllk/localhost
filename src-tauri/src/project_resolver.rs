use std::collections::HashMap;
use std::path::Path;

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
    "mix.exs",
    "Makefile",
];

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
fn resolve_project(cwd: &str, projects_dir: &str) -> (String, String, String) {
    if cwd.is_empty() {
        return ("Other".to_string(), String::new(), String::new());
    }

    let cwd_path = Path::new(cwd);
    let expanded_dir = expand_tilde(projects_dir);

    // Strategy 1: Check if cwd is under projects_dir
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
                        if s.is_empty() {
                            s
                        } else {
                            format!("/{s}")
                        }
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
pub fn group_by_project(processes: Vec<ProcessInfo>, projects_dir: &str) -> Vec<ProjectGroup> {
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
