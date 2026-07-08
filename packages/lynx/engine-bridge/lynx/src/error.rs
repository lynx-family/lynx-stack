use std::path::PathBuf;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
  #[error(transparent)]
  Sys(#[from] crate::sys::Error),
  #[error("{field} contains an interior NUL byte")]
  InteriorNul { field: &'static str },
  #[error("Lynx returned null while attempting to {operation}")]
  NullPointer { operation: &'static str },
  #[error("the process-global windowless UI task runner is already set")]
  GlobalUiTaskRunnerAlreadySet,
  #[error("failed to {operation} {}: {source}", path.display())]
  Io {
    operation: &'static str,
    path: PathBuf,
    #[source]
    source: std::io::Error,
  },
  #[error("{0}")]
  Message(String),
}
