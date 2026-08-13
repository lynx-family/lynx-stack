use std::cell::RefCell;
use std::rc::Rc;

use swc_core::ecma::ast::ModuleItem;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MtsDefineKind {
  Snapshot,
  Worklet,
}

impl MtsDefineKind {
  pub fn as_str(&self) -> &'static str {
    match self {
      MtsDefineKind::Snapshot => "snapshot",
      MtsDefineKind::Worklet => "worklet",
    }
  }
}

#[derive(Debug, Clone)]
pub struct MTSDefine {
  pub kind: MtsDefineKind,
  pub id: String,
  pub items: Vec<ModuleItem>,
}

pub type MtsDefinesCollector = Rc<RefCell<Vec<MTSDefine>>>;

/// A `runtime: 'shared'` import referenced by a collected main-thread
/// definition. The bundler compiles `request` into the main-thread layer and
/// registers its namespace under `id`, which the definition looks up through
/// the runtime's shared-module registry.
#[derive(Debug, Clone)]
pub struct MtsSharedImport {
  pub id: String,
  pub request: String,
}

pub type MtsSharedImportsCollector = Rc<RefCell<Vec<MtsSharedImport>>>;

pub fn collect_mts_define(
  collector: &Option<MtsDefinesCollector>,
  kind: MtsDefineKind,
  id: String,
  items: Vec<ModuleItem>,
) {
  if let Some(collector) = collector {
    collector.borrow_mut().push(MTSDefine { kind, id, items });
  }
}
