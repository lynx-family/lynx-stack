#[derive(Clone)]
pub enum WorkletType {
  Element,
  UI,
  Background,
}

impl WorkletType {
  pub fn from_directive(directive: String) -> Option<WorkletType> {
    if directive == "main thread" || directive == "main-thread" {
      Some(WorkletType::Element)
    } else if directive == "use worklet" {
      Some(WorkletType::UI)
    } else if directive == "use background" || directive == "background" {
      Some(WorkletType::Background)
    } else {
      None
    }
  }

  pub fn type_str(&self) -> &str {
    match self {
      WorkletType::Element => "main-thread",
      WorkletType::UI => "ui",
      WorkletType::Background => "background",
    }
  }
}
