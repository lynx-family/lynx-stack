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

#[cfg(test)]
mod tests {
  use super::*;
  use swc_core::common::DUMMY_SP;
  use swc_core::quote;

  #[test]
  fn excludes_type_only_unused_and_locally_declared_bindings() {
    let named = |name: &str, is_type_only| {
      ImportSpecifier::Named(ImportNamedSpecifier {
        span: DUMMY_SP,
        local: Ident::new_no_ctxt(name.into(), DUMMY_SP),
        imported: None,
        is_type_only,
      })
    };
    let import = ImportDecl {
      span: DUMMY_SP,
      phase: ImportPhase::Evaluation,
      specifiers: vec![named("needed", false)],
      src: Box::new("./values.js".into()),
      type_only: false,
      with: None,
    };
    let stmt = quote!("function handler(captured) { return [needed, captured]; }" as Stmt);
    let collected = collect_imports(
      &stmt,
      &[
        ImportDecl {
          type_only: true,
          ..import.clone()
        },
        ImportDecl {
          specifiers: vec![named("needed", true)],
          ..import.clone()
        },
        ImportDecl {
          specifiers: vec![
            named("needed", false),
            named("captured", false),
            named("unused", false),
          ],
          ..import
        },
      ],
    );
    assert_eq!(collected.len(), 1);
    let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = &collected[0] else {
      panic!("expected a dependency import");
    };
    assert_eq!(import.specifiers.len(), 1);
    assert_eq!(import.specifiers[0].local().sym, "needed");
  }
}
