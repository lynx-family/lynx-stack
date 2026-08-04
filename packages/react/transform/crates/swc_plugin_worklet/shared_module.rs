use rustc_hash::FxHashMap;
use sha1::{Digest, Sha1};
use swc_core::atoms::Atom;
use swc_core::ecma::ast::*;
use swc_core::ecma::utils::private_ident;
use swc_core::ecma::visit::{noop_visit_mut_type, VisitMut, VisitMutWith};
use swc_core::quote;

/// How a `runtime: 'shared'` import binds its local identifier to the shared
/// module's namespace.
#[derive(Debug, Clone)]
pub enum SharedImportedName {
  /// `import { name } from ...` / `import { name as local } from ...`
  Named(Atom),
  /// `import { "some-string" as local } from ...`
  NamedStr(String),
  /// `import local from ...`
  Default,
  /// `import * as local from ...`
  Namespace,
}

/// A local identifier introduced by a `runtime: 'shared'` import.
#[derive(Debug, Clone)]
pub struct SharedImportRef {
  pub module_id: String,
  pub request: String,
  pub imported: SharedImportedName,
}

/// The stable registry key of a shared module. Derived from the importing
/// module's (project-relative) filename and the request string, so it stays
/// identical across builds and machines, and the bundler can reuse it verbatim
/// from the reported shared imports without re-deriving it.
pub fn shared_module_id(filename: &str, request: &str) -> String {
  let mut hasher = Sha1::new();
  hasher.update(filename.as_bytes());
  hasher.update(b":");
  hasher.update(request.as_bytes());
  hex::encode(hasher.finalize())[0..16].to_string()
}

fn is_valid_ident_name(name: &str) -> bool {
  let mut chars = name.chars();
  match chars.next() {
    Some(c) if c.is_ascii_alphabetic() || c == '_' || c == '$' => {}
    _ => return false,
  }
  chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
}

/// A shared module referenced by one collected definition, cached in a local
/// at the top of the registered worklet function.
pub struct UsedSharedModule {
  pub module_id: String,
  pub request: String,
  cache_ident: Ident,
}

/// Rewrites references to `runtime: 'shared'` imports inside a collected
/// main-thread definition into lookups of the runtime's shared-module
/// registry. The namespace is cached in a local at worklet entry, so the
/// registry is consulted once per invocation rather than once per access
/// (the `const` is lowered to `var` when the define is printed):
///
/// ```js
/// var _$sharedModule = getSharedModule("<id>");
/// _$sharedModule.springCurve(...)
/// ```
pub struct SharedRefRewriter<'a> {
  refs: &'a FxHashMap<Id, SharedImportRef>,
  used: Vec<UsedSharedModule>,
}

impl<'a> SharedRefRewriter<'a> {
  /// Rewrites the shared references inside the function registered by a
  /// collected define and prepends the cache locals to its body. Returns the
  /// shared modules the define ended up using.
  pub fn rewrite_function(
    refs: &'a FxHashMap<Id, SharedImportRef>,
    function: &mut Function,
  ) -> Vec<UsedSharedModule> {
    let mut rewriter = SharedRefRewriter { refs, used: vec![] };
    function.visit_mut_with(&mut rewriter);

    if let Some(body) = function.body.as_mut() {
      for (i, used) in rewriter.used.iter().enumerate() {
        body.stmts.insert(
          i,
          quote!("const $cache = getSharedModule($id)" as Stmt,
            cache = used.cache_ident.clone(),
            id: Expr = Expr::Lit(used.module_id.clone().into()),
          ),
        );
      }
    }

    rewriter.used
  }

  fn cache_ident_for(&mut self, r: &SharedImportRef) -> Ident {
    if let Some(used) = self.used.iter().find(|u| u.module_id == r.module_id) {
      return used.cache_ident.clone();
    }
    let cache_ident = private_ident!("_$sharedModule");
    self.used.push(UsedSharedModule {
      module_id: r.module_id.clone(),
      request: r.request.clone(),
      cache_ident: cache_ident.clone(),
    });
    cache_ident
  }

  fn replacement(&mut self, r: &SharedImportRef) -> Expr {
    let r = r.clone();
    let cache = self.cache_ident_for(&r);
    match &r.imported {
      SharedImportedName::Namespace => Expr::Ident(cache),
      SharedImportedName::Default => member(cache, MemberProp::Ident("default".into())),
      SharedImportedName::Named(name) if is_valid_ident_name(name) => {
        member(cache, MemberProp::Ident(IdentName::from(name.clone())))
      }
      SharedImportedName::Named(name) => computed_member(cache, name.to_string()),
      SharedImportedName::NamedStr(name) => computed_member(cache, name.clone()),
    }
  }
}

fn member(obj: Ident, prop: MemberProp) -> Expr {
  Expr::Member(MemberExpr {
    span: Default::default(),
    obj: Box::new(Expr::Ident(obj)),
    prop,
  })
}

fn computed_member(obj: Ident, name: String) -> Expr {
  member(
    obj,
    MemberProp::Computed(ComputedPropName {
      span: Default::default(),
      expr: Box::new(Expr::Lit(name.into())),
    }),
  )
}

impl VisitMut for SharedRefRewriter<'_> {
  noop_visit_mut_type!();

  fn visit_mut_expr(&mut self, n: &mut Expr) {
    if let Expr::Ident(id) = n {
      if let Some(r) = self.refs.get(&id.to_id()) {
        let r = r.clone();
        *n = self.replacement(&r);
        return;
      }
    }
    n.visit_mut_children_with(self);
  }

  fn visit_mut_prop(&mut self, n: &mut Prop) {
    if let Prop::Shorthand(id) = n {
      if let Some(r) = self.refs.get(&id.to_id()) {
        let r = r.clone();
        *n = Prop::KeyValue(KeyValueProp {
          key: PropName::Ident(id.clone().into()),
          value: Box::new(self.replacement(&r)),
        });
        return;
      }
    }
    n.visit_mut_children_with(self);
  }
}
