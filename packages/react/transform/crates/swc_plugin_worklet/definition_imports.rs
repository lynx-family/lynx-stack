use rustc_hash::FxHashSet;
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{Visit, VisitWith};

#[derive(Default)]
struct References {
  used: FxHashSet<Id>,
  declared: FxHashSet<Id>,
}

impl Visit for References {
  fn visit_ident(&mut self, ident: &Ident) {
    self.used.insert(ident.to_id());
  }

  fn visit_binding_ident(&mut self, ident: &BindingIdent) {
    self.declared.insert(ident.to_id());
  }
}

pub fn collect_imports(stmt: &Stmt, imports: &[ImportDecl]) -> Vec<ModuleItem> {
  let mut references = References::default();
  stmt.visit_with(&mut references);
  let mut items = vec![];
  for import in imports {
    if import.type_only {
      continue;
    }
    let mut import = import.clone();
    import.specifiers.retain(|specifier| {
      if matches!(specifier, ImportSpecifier::Named(named) if named.is_type_only) {
        return false;
      }
      let id = specifier.local().to_id();
      references.used.contains(&id) && !references.declared.contains(&id)
    });
    if !import.specifiers.is_empty() {
      items.push(ModuleItem::ModuleDecl(ModuleDecl::Import(import)));
    }
  }
  items
}
