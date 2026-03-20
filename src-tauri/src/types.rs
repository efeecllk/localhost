use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub port: Option<u16>,
    #[serde(rename = "fullPath")]
    pub cwd: String,
    pub relative_path: String,
    #[serde(rename = "uptime")]
    pub uptime_secs: u64,
    pub cpu_percent: f32,
    pub memory_mb: u64,
    pub status: String,
    pub source: String,
    pub docker_info: Option<DockerContainerInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainerInfo {
    pub container_id: String,
    pub container_name: String,
    pub image: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGroup {
    pub name: String,
    pub path: String,
    pub processes: Vec<ProcessInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub scan_interval: u32,
    pub projects_dir: String,
    pub theme: String,
    pub editor_command: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            scan_interval: 5000,
            projects_dir: dirs::home_dir()
                .map(|h| format!("{}/Desktop/Projects", h.display()))
                .unwrap_or_default(),
            theme: "system".to_string(),
            editor_command: "cursor".to_string(),
        }
    }
}
