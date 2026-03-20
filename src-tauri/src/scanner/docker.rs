use bollard::container::ListContainersOptions;
use bollard::Docker;

use crate::errors::ScanError;
use crate::types::{DockerContainerInfo, ProcessInfo};

/// Query the Docker daemon for running containers.
/// Returns an empty vec if Docker is not running (Docker is optional).
pub async fn scan_docker_containers() -> Result<Vec<ProcessInfo>, ScanError> {
    // Connect to Docker socket. If Docker is not running, return empty vec.
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

    let containers = docker
        .list_containers(Some(options))
        .await
        .map_err(|e| ScanError::DockerError(e.to_string()))?;

    let mut results = Vec::new();

    for container in containers {
        let container_id = container.id.unwrap_or_default();
        let container_name = container
            .names
            .and_then(|n| n.first().cloned())
            .unwrap_or_default()
            .trim_start_matches('/')
            .to_string();
        let image = container.image.unwrap_or_default();
        let status = container.status.unwrap_or_default();
        let labels = container.labels.unwrap_or_default();

        // Extract exposed ports
        let ports: Vec<u16> = container
            .ports
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

        // Determine uptime from status string
        let uptime_secs = parse_docker_uptime(&status);
        let health = docker_status_to_health(&status);

        let docker_info = DockerContainerInfo {
            container_id: container_id.clone(),
            container_name: container_name.clone(),
            image: image.clone(),
            status: status.clone(),
        };

        // If container exposes multiple ports, create one entry per port.
        // If no ports, create one entry with port = None.
        if ports.is_empty() {
            results.push(ProcessInfo {
                pid: 0,
                name: format!("docker/{}", short_image_name(&image)),
                port: None,
                cwd: compose_workdir.clone(),
                relative_path: String::new(),
                uptime_secs,
                cpu_percent: 0.0,
                memory_mb: 0,
                status: health.clone(),
                source: "docker".to_string(),
                docker_info: Some(docker_info),
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
                    status: health.clone(),
                    source: "docker".to_string(),
                    docker_info: Some(docker_info.clone()),
                });
            }
        }
    }

    Ok(results)
}

/// Extract short image name: "postgres:15-alpine" -> "postgres"
fn short_image_name(image: &str) -> &str {
    image
        .split(':')
        .next()
        .unwrap_or(image)
        .rsplit('/')
        .next()
        .unwrap_or(image)
}

/// Parse Docker uptime from status string like "Up 2 hours" or "Up 35 minutes"
fn parse_docker_uptime(status: &str) -> u64 {
    let lower = status.to_lowercase();
    if let Some(rest) = lower.strip_prefix("up ") {
        if rest.contains("second") {
            rest.split_whitespace()
                .next()
                .and_then(|n| n.parse::<u64>().ok())
                .unwrap_or(0)
        } else if rest.contains("minute") {
            rest.split_whitespace()
                .next()
                .and_then(|n| n.parse::<u64>().ok())
                .map(|n| n * 60)
                .unwrap_or(0)
        } else if rest.contains("hour") {
            rest.split_whitespace()
                .next()
                .and_then(|n| n.parse::<u64>().ok())
                .map(|n| n * 3600)
                .unwrap_or(0)
        } else if rest.contains("day") {
            rest.split_whitespace()
                .next()
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

/// Convert Docker status string to a health status.
fn docker_status_to_health(status: &str) -> String {
    let lower = status.to_lowercase();
    if lower.contains("unhealthy") || lower.contains("exited") {
        "crashed".to_string()
    } else {
        "healthy".to_string()
    }
}
