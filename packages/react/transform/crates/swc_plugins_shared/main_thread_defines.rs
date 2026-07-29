use std::cell::RefCell;
use std::rc::Rc;

use swc_core::ecma::ast::ModuleItem;

/// What a collected main-thread definition registers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MainThreadDefineKind {
  Snapshot,
  Worklet,
}

impl MainThreadDefineKind {
  pub fn as_str(&self) -> &'static str {
    match self {
      MainThreadDefineKind::Snapshot => "snapshot",
      MainThreadDefineKind::Worklet => "worklet",
    }
  }
}

/// A definition the main thread needs, collected while the background compiles
/// the module. `items` is a self-contained statement list: it declares its own
/// locals and calls the runtime through the module's runtime namespace import.
#[derive(Debug, Clone)]
pub struct MainThreadDefine {
  pub kind: MainThreadDefineKind,
  /// The snapshot uid or the worklet hash. Definitions with the same id are
  /// interchangeable, so the assembler can drop duplicates.
  pub id: String,
  pub items: Vec<ModuleItem>,
}

/// Shared by the snapshot and worklet plugins: when set, each plugin pushes the
/// definitions it generates here, in emission order.
pub type MainThreadDefinesCollector = Rc<RefCell<Vec<MainThreadDefine>>>;

/// Push a definition into `collector`, if collection is enabled.
pub fn collect_main_thread_define(
  collector: &Option<MainThreadDefinesCollector>,
  kind: MainThreadDefineKind,
  id: String,
  items: Vec<ModuleItem>,
) {
  if let Some(collector) = collector {
    collector
      .borrow_mut()
      .push(MainThreadDefine { kind, id, items });
  }
}
