use std::cell::RefCell;
use std::rc::Rc;

use swc_core::ecma::ast::ModuleItem;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DefineKind {
  Snapshot,
  Worklet,
}

#[derive(Debug, Clone)]
pub struct Define {
  pub kind: DefineKind,
  pub id: String,
  pub items: Vec<ModuleItem>,
}

pub type DefinesCollector = Rc<RefCell<Vec<Define>>>;

pub fn collect_define(
  collector: &Option<DefinesCollector>,
  kind: DefineKind,
  id: String,
  items: Vec<ModuleItem>,
) {
  if let Some(collector) = collector {
    collector.borrow_mut().push(Define { kind, id, items });
  }
}
