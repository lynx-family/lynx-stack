use std::cell::RefCell;
use std::rc::Rc;

use swc_core::ecma::ast::ModuleItem;

/// The kind of a main-thread definition.
///
/// Keep this extensible: new sources of main-thread definitions (e.g. a
/// root-fallback section) add a variant here and reuse the same registry —
/// the `kind:id` namespace keeps them apart.
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

/// A full main-thread definition collected for assembly into the main-thread
/// chunk of another compilation.
#[derive(Debug, Clone)]
pub struct MTSDefine {
  pub kind: MtsDefineKind,
  pub id: String,
  pub items: Vec<ModuleItem>,
}

/// The identity of a definition a module emits *in place* — in its own
/// main-thread output. Assembly subtracts these from the collected set so a
/// definition never registers twice.
#[derive(Debug, Clone)]
pub struct MtsDefineIdentity {
  pub kind: MtsDefineKind,
  pub id: String,
}

/// Per-module registry of main-thread definitions.
///
/// One registry lives for one transform invocation (one module), so every
/// entry is attributed to that module. It records two disjoint views:
///
/// - `defines`: full definitions to assemble into another chunk
///   (collected while compiling the background);
/// - `in_place`: identities of the definitions this module's own output
///   already registers (recorded while compiling the main thread).
///
/// The two activities are gated independently because full collection also
/// changes plugin codegen (main-thread creator variants, shared-import
/// rejection), while in-place recording must observe the normal output
/// without altering it.
#[derive(Debug, Default)]
pub struct MtsDefinesRegistry {
  collect_defines: bool,
  record_in_place: bool,
  pub defines: Vec<MTSDefine>,
  pub in_place: Vec<MtsDefineIdentity>,
}

impl MtsDefinesRegistry {
  pub fn new(collect_defines: bool, record_in_place: bool) -> Self {
    MtsDefinesRegistry {
      collect_defines,
      record_in_place,
      defines: vec![],
      in_place: vec![],
    }
  }

  pub fn is_collecting(&self) -> bool {
    self.collect_defines
  }

  pub fn is_recording_in_place(&self) -> bool {
    self.record_in_place
  }
}

pub type MtsDefinesCollector = Rc<RefCell<MtsDefinesRegistry>>;

/// Whether full definition collection is active. Plugins gate the codegen
/// changes collection needs (not the in-place recording) on this.
pub fn is_collecting_mts_defines(collector: &Option<MtsDefinesCollector>) -> bool {
  collector
    .as_ref()
    .is_some_and(|collector| collector.borrow().is_collecting())
}

pub fn collect_mts_define(
  collector: &Option<MtsDefinesCollector>,
  kind: MtsDefineKind,
  id: String,
  items: Vec<ModuleItem>,
) {
  if let Some(collector) = collector {
    let mut registry = collector.borrow_mut();
    if registry.is_collecting() {
      registry.defines.push(MTSDefine { kind, id, items });
    }
  }
}

pub fn record_in_place_mts_define(
  collector: &Option<MtsDefinesCollector>,
  kind: MtsDefineKind,
  id: String,
) {
  if let Some(collector) = collector {
    let mut registry = collector.borrow_mut();
    if registry.is_recording_in_place() {
      registry.in_place.push(MtsDefineIdentity { kind, id });
    }
  }
}
