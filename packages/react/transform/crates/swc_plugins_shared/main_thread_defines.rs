use std::cell::RefCell;
use std::rc::Rc;

use swc_core::ecma::ast::ModuleItem;

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

#[derive(Debug, Clone)]
pub struct MainThreadDefine {
  pub kind: MainThreadDefineKind,
  pub id: String,
  pub items: Vec<ModuleItem>,
}

pub type MainThreadDefinesCollector = Rc<RefCell<Vec<MainThreadDefine>>>;

pub fn collect_main_thread_define(
  collector: &Option<MainThreadDefinesCollector>,
  kind: MainThreadDefineKind,
  id: String,
  items: Vec<ModuleItem>,
) {
  if let Some(collector) = collector {
    collector.borrow_mut().push(MainThreadDefine { kind, id, items });
  }
}
