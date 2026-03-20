use thiserror::Error;

#[derive(Error, Debug)]
#[allow(clippy::enum_variant_names)]
pub enum ScanError {
    #[error("Failed to scan network ports: {0}")]
    NetstatError(String),

    #[error("Docker error: {0}")]
    DockerError(String),

    #[error("Process error: {0}")]
    #[allow(dead_code)]
    ProcessError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}
