use std::fmt;
use std::path::PathBuf;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug)]
pub enum Error {
  Sys(crate::sys::Error),
  InteriorNul {
    field: &'static str,
  },
  NullPointer {
    operation: &'static str,
  },
  GlobalUiTaskRunnerAlreadySet,
  Io {
    operation: &'static str,
    path: PathBuf,
    source: std::io::Error,
  },
  Message(String),
}

impl From<crate::sys::Error> for Error {
  fn from(value: crate::sys::Error) -> Self {
    Error::Sys(value)
  }
}

impl fmt::Display for Error {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Error::Sys(error) => error.fmt(f),
      Error::InteriorNul { field } => write!(f, "{field} contains an interior NUL byte"),
      Error::NullPointer { operation } => {
        write!(f, "Lynx returned null while attempting to {operation}")
      }
      Error::GlobalUiTaskRunnerAlreadySet => {
        write!(
          f,
          "the process-global windowless UI task runner is already set"
        )
      }
      Error::Io {
        operation,
        path,
        source,
      } => write!(f, "failed to {operation} {}: {source}", path.display()),
      Error::Message(message) => f.write_str(message),
    }
  }
}

impl std::error::Error for Error {
  fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
    match self {
      Error::Sys(error) => Some(error),
      Error::Io { source, .. } => Some(source),
      _ => None,
    }
  }
}
