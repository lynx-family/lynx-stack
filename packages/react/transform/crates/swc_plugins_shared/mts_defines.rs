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
