use rustc_hash::FxHashMap;
use serde::{Deserialize, Serialize};
use std::{
  cell::RefCell,
  collections::{BTreeMap, BTreeSet},
  rc::Rc,
};
use swc_core::{
  common::{errors::HANDLER, util::take::Take, Span, Spanned},
  ecma::{
    ast::*,
    visit::{noop_visit_mut_type, VisitMut, VisitMutWith},
  },
};

pub const DIRECTIVE_INFERENCE_PROTOCOL_VERSION: u32 = 1;
const OPT_OUT_DIRECTIVE: &str = "use no main thread";
const INFERRED_DIRECTIVE: &str = "main thread";

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DirectiveInferenceConfig {
  pub protocol_version: u32,
  #[serde(default)]
  pub modules: Vec<DirectiveInferenceModule>,
}

impl Default for DirectiveInferenceConfig {
  fn default() -> Self {
    Self {
      protocol_version: DIRECTIVE_INFERENCE_PROTOCOL_VERSION,
      modules: vec![],
    }
  }
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DirectiveInferenceModule {
  pub source: String,
  pub package: String,
  pub package_version: Option<String>,
  pub manifest: Option<String>,
  #[serde(default)]
  pub exports: BTreeMap<String, DirectiveInferenceDeclaration>,
}

#[derive(Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DirectiveInferenceDeclaration {
  #[serde(default)]
  pub marker: bool,
  #[serde(default)]
  pub args: BTreeMap<String, DirectiveInferenceRule>,
  #[serde(default)]
  pub props: BTreeMap<String, DirectiveInferenceRule>,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(untagged)]
pub enum DirectiveInferenceRule {
  Leaf(bool),
  Wildcard(String),
  Paths(BTreeMap<String, DirectiveInferenceRule>),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectiveInferenceRecord {
  pub filename: String,
  pub start: u32,
  pub end: u32,
  pub package: String,
  pub package_version: Option<String>,
  pub manifest: Option<String>,
  pub source: String,
  pub export: String,
  pub path: String,
}

pub type DirectiveInferenceCollector = Rc<RefCell<Vec<DirectiveInferenceRecord>>>;

#[derive(Clone, Debug)]
struct ImportedBinding {
  source: String,
  export: Vec<String>,
}

#[derive(Clone, Debug)]
struct ResolvedDeclaration {
  module: DirectiveInferenceModule,
  export: String,
  declaration: DirectiveInferenceDeclaration,
}

pub struct DirectiveInferenceVisitor {
  config: DirectiveInferenceConfig,
  filename: String,
  modules: BTreeMap<String, DirectiveInferenceModule>,
  imports: FxHashMap<Id, ImportedBinding>,
  collector: Option<DirectiveInferenceCollector>,
  file_start: u32,
  opted_out: bool,
  config_checked: bool,
}

impl DirectiveInferenceVisitor {
  pub fn new(config: DirectiveInferenceConfig, filename: String) -> Self {
    let modules = config
      .modules
      .iter()
      .cloned()
      .map(|module| (module.source.clone(), module))
      .collect();
    Self {
      config,
      filename,
      modules,
      imports: Default::default(),
      collector: None,
      file_start: 0,
      opted_out: false,
      config_checked: false,
    }
  }

  pub fn with_collector(mut self, collector: DirectiveInferenceCollector) -> Self {
    self.collector = Some(collector);
    self
  }

  /// Normalize recorded spans to file-local, zero-based offsets. Spans are
  /// global `BytePos` values within the transform's source map; passing the
  /// source file's `start_pos` here makes `DirectiveInferenceRecord.start`/
  /// `end` sliceable offsets into the source text.
  pub fn with_file_start(mut self, file_start: u32) -> Self {
    self.file_start = file_start;
    self
  }

  fn check_config(&mut self, span: Span) -> bool {
    if self.config_checked {
      return self.config.protocol_version == DIRECTIVE_INFERENCE_PROTOCOL_VERSION;
    }
    self.config_checked = true;
    if self.config.protocol_version != DIRECTIVE_INFERENCE_PROTOCOL_VERSION {
      HANDLER.with(|handler| {
        handler
          .struct_span_err(
            span,
            &format!(
              "unsupported directive-inference protocol version {}; expected {}",
              self.config.protocol_version, DIRECTIVE_INFERENCE_PROTOCOL_VERSION
            ),
          )
          .emit();
      });
      return false;
    }

    let mut sources = BTreeSet::new();
    for module in &self.config.modules {
      if module.source.is_empty() || module.package.is_empty() {
        HANDLER.with(|handler| {
          handler
            .struct_span_err(
              span,
              "directive-inference modules require non-empty `source` and `package` fields",
            )
            .emit();
        });
        return false;
      }
      if !sources.insert(module.source.as_str()) {
        HANDLER.with(|handler| {
          handler
            .struct_span_err(
              span,
              &format!(
                "directive-inference config contains duplicate module source `{}`",
                module.source
              ),
            )
            .emit();
        });
        return false;
      }
      for (export, declaration) in &module.exports {
        if export.is_empty()
          || !declaration
            .args
            .keys()
            .chain(declaration.props.keys())
            .all(|key| key == "*" || !key.is_empty())
          || !declaration
            .args
            .values()
            .chain(declaration.props.values())
            .all(Self::valid_rule)
        {
          HANDLER.with(|handler| {
            handler
              .struct_span_err(
                span,
                &format!(
                  "invalid directive-inference declaration for `{}` from `{}`",
                  export, module.source
                ),
              )
              .emit();
          });
          return false;
        }
      }
    }
    true
  }

  fn valid_rule(rule: &DirectiveInferenceRule) -> bool {
    match rule {
      DirectiveInferenceRule::Leaf(value) => *value,
      DirectiveInferenceRule::Wildcard(value) => value == "*" || value == "**",
      DirectiveInferenceRule::Paths(paths) => {
        !paths.is_empty()
          && paths
            .iter()
            .all(|(key, value)| !key.is_empty() && Self::valid_rule(value))
      }
    }
  }

  fn collect_imports(&mut self, body: &[ModuleItem]) {
    for item in body {
      let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = item else {
        continue;
      };
      if import.type_only || import.phase == ImportPhase::Source {
        continue;
      }
      let source = import.src.value.to_string_lossy().into_owned();
      if !self.modules.contains_key(&source) {
        continue;
      }
      for specifier in &import.specifiers {
        let (local, export) = match specifier {
          ImportSpecifier::Named(named) if !named.is_type_only => (
            named.local.to_id(),
            vec![match &named.imported {
              Some(ModuleExportName::Ident(imported)) => imported.sym.to_string(),
              Some(ModuleExportName::Str(imported)) => {
                imported.value.to_string_lossy().into_owned()
              }
              None => named.local.sym.to_string(),
            }],
          ),
          ImportSpecifier::Named(_) => continue,
          ImportSpecifier::Default(default) => (default.local.to_id(), vec!["default".to_string()]),
          ImportSpecifier::Namespace(namespace) => (namespace.local.to_id(), vec![]),
          #[cfg(swc_ast_unknown)]
          _ => continue,
        };
        self.imports.insert(
          local,
          ImportedBinding {
            source: source.clone(),
            export,
          },
        );
      }
    }
  }

  fn resolve_expr_identity(&self, expr: &Expr) -> Option<(String, Vec<String>)> {
    match expr {
      Expr::Ident(ident) => self
        .imports
        .get(&ident.to_id())
        .map(|binding| (binding.source.clone(), binding.export.clone())),
      Expr::Member(member) => {
        let property = static_member_property(&member.prop)?;
        let (source, mut export) = self.resolve_expr_identity(&member.obj)?;
        export.push(property);
        Some((source, export))
      }
      Expr::Paren(paren) => self.resolve_expr_identity(&paren.expr),
      Expr::TsAs(expr) => self.resolve_expr_identity(&expr.expr),
      Expr::TsSatisfies(expr) => self.resolve_expr_identity(&expr.expr),
      Expr::TsTypeAssertion(expr) => self.resolve_expr_identity(&expr.expr),
      Expr::TsConstAssertion(expr) => self.resolve_expr_identity(&expr.expr),
      Expr::TsNonNull(expr) => self.resolve_expr_identity(&expr.expr),
      _ => None,
    }
  }

  fn resolve_jsx_identity(&self, name: &JSXElementName) -> Option<(String, Vec<String>)> {
    match name {
      JSXElementName::Ident(ident) => self
        .imports
        .get(&ident.to_id())
        .map(|binding| (binding.source.clone(), binding.export.clone())),
      JSXElementName::JSXMemberExpr(member) => {
        let (source, mut export) = self.resolve_jsx_object_identity(&member.obj)?;
        export.push(member.prop.sym.to_string());
        Some((source, export))
      }
      JSXElementName::JSXNamespacedName(_) => None,
    }
  }

  fn resolve_jsx_object_identity(&self, object: &JSXObject) -> Option<(String, Vec<String>)> {
    match object {
      JSXObject::Ident(ident) => self
        .imports
        .get(&ident.to_id())
        .map(|binding| (binding.source.clone(), binding.export.clone())),
      JSXObject::JSXMemberExpr(member) => {
        let (source, mut export) = self.resolve_jsx_object_identity(&member.obj)?;
        export.push(member.prop.sym.to_string());
        Some((source, export))
      }
    }
  }

  fn resolve_declaration(
    &self,
    identity: Option<(String, Vec<String>)>,
  ) -> Option<ResolvedDeclaration> {
    let (source, export) = identity?;
    let export = export.join(".");
    let module = self.modules.get(&source)?;
    let declaration = module.exports.get(&export)?;
    Some(ResolvedDeclaration {
      module: module.clone(),
      export,
      declaration: declaration.clone(),
    })
  }

  fn apply_call_declaration(&mut self, call: &mut CallExpr, resolved: &ResolvedDeclaration) {
    if resolved.declaration.marker && !resolved.declaration.args.contains_key("0") {
      if let Some(argument) = call.args.first_mut() {
        if argument.spread.is_some() {
          self.emit_indirect(argument.span(), resolved, "marker.0", "spread argument");
        } else {
          self.apply_rule(
            &mut argument.expr,
            &DirectiveInferenceRule::Leaf(true),
            resolved,
            "marker.0",
          );
        }
      }
    }

    for (index, argument) in call.args.iter_mut().enumerate() {
      let index_key = index.to_string();
      // An indexed declaration wins over the `*` fallback, mirroring the
      // JSX prop resolution semantics.
      let Some(rule) = resolved
        .declaration
        .args
        .get(&index_key)
        .or_else(|| resolved.declaration.args.get("*"))
        .cloned()
      else {
        continue;
      };
      let path = format!("args.{index}");
      if argument.spread.is_some() {
        self.emit_indirect(argument.span(), resolved, &path, "spread argument");
      } else {
        self.apply_rule(&mut argument.expr, &rule, resolved, &path);
      }
    }
  }

  fn apply_jsx_declaration(&mut self, element: &mut JSXElement, resolved: &ResolvedDeclaration) {
    for attribute in &mut element.opening.attrs {
      match attribute {
        JSXAttrOrSpread::SpreadElement(spread) => {
          if !resolved.declaration.props.is_empty() {
            self.emit_indirect(spread.span(), resolved, "props", "JSX spread");
          }
        }
        JSXAttrOrSpread::JSXAttr(attribute) => {
          let JSXAttrName::Ident(name) = &attribute.name else {
            continue;
          };
          let name = name.sym.to_string();
          let Some(rule) = resolved
            .declaration
            .props
            .get(&name)
            .or_else(|| resolved.declaration.props.get("*"))
            .cloned()
          else {
            continue;
          };
          let path = format!("props.{name}");
          let Some(JSXAttrValue::JSXExprContainer(container)) = attribute.value.as_mut() else {
            self.emit_indirect(attribute.span, resolved, &path, "non-expression JSX value");
            continue;
          };
          let JSXExpr::Expr(expr) = &mut container.expr else {
            self.emit_indirect(container.span, resolved, &path, "empty JSX expression");
            continue;
          };
          self.apply_rule(expr, &rule, resolved, &path);
        }
      }
    }
  }

  fn apply_rule(
    &mut self,
    expr: &mut Box<Expr>,
    rule: &DirectiveInferenceRule,
    resolved: &ResolvedDeclaration,
    path: &str,
  ) {
    let expr = unwrap_transparent_expr(expr);
    match rule {
      DirectiveInferenceRule::Leaf(true) => {
        if !self.insert_directive(expr, resolved, path) && !is_absent_value(expr) {
          self.emit_indirect(
            expr.span(),
            resolved,
            path,
            "indirect or non-function value",
          );
        }
      }
      DirectiveInferenceRule::Leaf(false) => {}
      DirectiveInferenceRule::Wildcard(value) if value == "*" => {
        if self.insert_directive(expr, resolved, path) {
          return;
        }
        match expr {
          Expr::Object(object) => {
            self.apply_wildcard_object(object, false, resolved, path);
          }
          Expr::Array(array) => {
            self.apply_wildcard_array(array, false, resolved, path);
          }
          _ if is_primitive_value(expr) => {}
          _ => self.emit_indirect(expr.span(), resolved, path, "indirect structural value"),
        }
      }
      DirectiveInferenceRule::Wildcard(value) if value == "**" => {
        if self.insert_directive(expr, resolved, path) {
          return;
        }
        match expr {
          Expr::Object(object) => {
            self.apply_wildcard_object(object, true, resolved, path);
          }
          Expr::Array(array) => {
            self.apply_wildcard_array(array, true, resolved, path);
          }
          _ if is_primitive_value(expr) => {}
          _ => self.emit_indirect(expr.span(), resolved, path, "indirect structural value"),
        }
      }
      DirectiveInferenceRule::Paths(paths) => match expr {
        Expr::Object(object) => self.apply_object_paths(object, paths, resolved, path),
        Expr::Array(array) => self.apply_array_paths(array, paths, resolved, path),
        _ if is_absent_value(expr) => {}
        _ => self.emit_indirect(expr.span(), resolved, path, "indirect structural value"),
      },
      DirectiveInferenceRule::Wildcard(_) => {}
    }
  }

  fn apply_object_paths(
    &mut self,
    object: &mut ObjectLit,
    paths: &BTreeMap<String, DirectiveInferenceRule>,
    resolved: &ResolvedDeclaration,
    base_path: &str,
  ) {
    for property in &mut object.props {
      let PropOrSpread::Prop(property) = property else {
        self.emit_indirect(property.span(), resolved, base_path, "object spread");
        continue;
      };
      match property.as_mut() {
        Prop::KeyValue(key_value) => {
          let Some(key) = static_property_name(&key_value.key) else {
            self.emit_indirect(
              key_value.key.span(),
              resolved,
              base_path,
              "computed property",
            );
            continue;
          };
          if let Some(rule) = paths.get(&key).or_else(|| paths.get("*")) {
            self.apply_rule(
              &mut key_value.value,
              rule,
              resolved,
              &format!("{base_path}.{key}"),
            );
          }
        }
        Prop::Method(method) => {
          let Some(key) = static_property_name(&method.key) else {
            self.emit_indirect(method.key.span(), resolved, base_path, "computed method");
            continue;
          };
          if let Some(rule) = paths.get(&key).or_else(|| paths.get("*")) {
            let path = format!("{base_path}.{key}");
            if matches!(rule, DirectiveInferenceRule::Leaf(true))
              || matches!(rule, DirectiveInferenceRule::Wildcard(_))
            {
              self.insert_method_directive(method, resolved, &path);
            } else {
              self.emit_indirect(
                method.function.span,
                resolved,
                &path,
                "non-leaf method path",
              );
            }
          }
        }
        Prop::Shorthand(ident) => {
          let key = ident.sym.to_string();
          if paths.contains_key(&key) || paths.contains_key("*") {
            self.emit_indirect(
              ident.span,
              resolved,
              &format!("{base_path}.{key}"),
              "shorthand property",
            );
          }
        }
        Prop::Assign(assign) => {
          let key = assign.key.sym.to_string();
          if paths.contains_key(&key) || paths.contains_key("*") {
            self.emit_indirect(
              assign.span,
              resolved,
              &format!("{base_path}.{key}"),
              "assignment property",
            );
          }
        }
        Prop::Getter(getter) => {
          if let Some(key) = static_property_name(&getter.key) {
            if paths.contains_key(&key) || paths.contains_key("*") {
              self.emit_indirect(
                getter.span,
                resolved,
                &format!("{base_path}.{key}"),
                "getter property",
              );
            }
          }
        }
        Prop::Setter(setter) => {
          if let Some(key) = static_property_name(&setter.key) {
            if paths.contains_key(&key) || paths.contains_key("*") {
              self.emit_indirect(
                setter.span,
                resolved,
                &format!("{base_path}.{key}"),
                "setter property",
              );
            }
          }
        }
      }
    }
  }

  fn apply_array_paths(
    &mut self,
    array: &mut ArrayLit,
    paths: &BTreeMap<String, DirectiveInferenceRule>,
    resolved: &ResolvedDeclaration,
    base_path: &str,
  ) {
    for (index, element) in array.elems.iter_mut().enumerate() {
      let Some(element) = element else {
        continue;
      };
      let index_key = index.to_string();
      let Some(rule) = paths.get(&index_key).or_else(|| paths.get("*")) else {
        continue;
      };
      let path = format!("{base_path}.{index}");
      if element.spread.is_some() {
        self.emit_indirect(element.span(), resolved, &path, "array spread");
      } else {
        self.apply_rule(&mut element.expr, rule, resolved, &path);
      }
    }
  }

  fn apply_wildcard_object(
    &mut self,
    object: &mut ObjectLit,
    deep: bool,
    resolved: &ResolvedDeclaration,
    base_path: &str,
  ) {
    for property in &mut object.props {
      let PropOrSpread::Prop(property) = property else {
        self.emit_indirect(property.span(), resolved, base_path, "object spread");
        continue;
      };
      match property.as_mut() {
        Prop::KeyValue(key_value) => {
          let Some(key) = static_property_name(&key_value.key) else {
            self.emit_indirect(
              key_value.key.span(),
              resolved,
              base_path,
              "computed property",
            );
            continue;
          };
          self.apply_wildcard_value(
            &mut key_value.value,
            deep,
            resolved,
            &format!("{base_path}.{key}"),
          );
        }
        Prop::Method(method) => {
          let Some(key) = static_property_name(&method.key) else {
            self.emit_indirect(method.key.span(), resolved, base_path, "computed method");
            continue;
          };
          self.insert_method_directive(method, resolved, &format!("{base_path}.{key}"));
        }
        Prop::Shorthand(ident) => self.emit_indirect(
          ident.span,
          resolved,
          &format!("{base_path}.{}", ident.sym),
          "shorthand property",
        ),
        Prop::Assign(assign) => self.emit_indirect(
          assign.span,
          resolved,
          &format!("{base_path}.{}", assign.key.sym),
          "assignment property",
        ),
        Prop::Getter(getter) => {
          self.emit_indirect(getter.span, resolved, base_path, "getter property")
        }
        Prop::Setter(setter) => {
          self.emit_indirect(setter.span, resolved, base_path, "setter property")
        }
      }
    }
  }

  fn apply_wildcard_array(
    &mut self,
    array: &mut ArrayLit,
    deep: bool,
    resolved: &ResolvedDeclaration,
    base_path: &str,
  ) {
    for (index, element) in array.elems.iter_mut().enumerate() {
      let Some(element) = element else {
        continue;
      };
      let path = format!("{base_path}.{index}");
      if element.spread.is_some() {
        self.emit_indirect(element.span(), resolved, &path, "array spread");
      } else {
        self.apply_wildcard_value(&mut element.expr, deep, resolved, &path);
      }
    }
  }

  fn apply_wildcard_value(
    &mut self,
    expr: &mut Box<Expr>,
    deep: bool,
    resolved: &ResolvedDeclaration,
    path: &str,
  ) {
    let expr = unwrap_transparent_expr(expr);
    if self.insert_directive(expr, resolved, path) {
      return;
    }
    match expr {
      Expr::Object(object) if deep => self.apply_wildcard_object(object, true, resolved, path),
      Expr::Array(array) if deep => self.apply_wildcard_array(array, true, resolved, path),
      Expr::Object(_) | Expr::Array(_) if !deep => {}
      _ if is_primitive_value(expr) => {}
      _ => self.emit_indirect(expr.span(), resolved, path, "indirect value"),
    }
  }

  fn insert_directive(
    &mut self,
    expr: &mut Expr,
    resolved: &ResolvedDeclaration,
    path: &str,
  ) -> bool {
    match expr {
      Expr::Arrow(arrow) => {
        let span = arrow.span;
        if arrow.body.is_expr() {
          let expression = arrow.body.take().expr().unwrap();
          *arrow.body = BlockStmt {
            span,
            ctxt: Default::default(),
            stmts: vec![
              directive_statement(span),
              ReturnStmt {
                span,
                arg: Some(expression),
              }
              .into(),
            ],
          }
          .into();
          self.record(span, resolved, path);
          true
        } else {
          let block = arrow.body.as_mut_block_stmt().unwrap();
          if prepend_directive(block, span) {
            self.record(span, resolved, path);
          }
          true
        }
      }
      Expr::Fn(function) => {
        let Some(body) = function.function.body.as_mut() else {
          return false;
        };
        if prepend_directive(body, function.function.span) {
          self.record(function.function.span, resolved, path);
        }
        true
      }
      _ => false,
    }
  }

  fn insert_method_directive(
    &mut self,
    method: &mut MethodProp,
    resolved: &ResolvedDeclaration,
    path: &str,
  ) {
    let Some(body) = method.function.body.as_mut() else {
      self.emit_indirect(
        method.function.span,
        resolved,
        path,
        "method without a body",
      );
      return;
    };
    if prepend_directive(body, method.function.span) {
      self.record(method.function.span, resolved, path);
    }
  }

  fn record(&mut self, span: Span, resolved: &ResolvedDeclaration, path: &str) {
    let Some(collector) = &self.collector else {
      return;
    };
    collector.borrow_mut().push(DirectiveInferenceRecord {
      filename: self.filename.clone(),
      start: span.lo.0.saturating_sub(self.file_start),
      end: span.hi.0.saturating_sub(self.file_start),
      package: resolved.module.package.clone(),
      package_version: resolved.module.package_version.clone(),
      manifest: resolved.module.manifest.clone(),
      source: resolved.module.source.clone(),
      export: resolved.export.clone(),
      path: path.to_string(),
    });
  }

  fn emit_indirect(&self, span: Span, resolved: &ResolvedDeclaration, path: &str, kind: &str) {
    HANDLER.with(|handler| {
      handler
        .struct_span_warn(
          span,
          &format!(
            "cannot infer a main-thread function for {} `{}` at declared path `{path}` from package `{}`; found {kind}. Inline a function literal or add the directive explicitly",
            resolved.module.source, resolved.export, resolved.module.package
          ),
        )
        .emit();
    });
  }
}

impl VisitMut for DirectiveInferenceVisitor {
  noop_visit_mut_type!();

  fn visit_mut_module(&mut self, module: &mut Module) {
    if !self.check_config(module.span) || has_opt_out_directive(&module.body) {
      self.opted_out = true;
      return;
    }
    self.collect_imports(&module.body);
    module.visit_mut_children_with(self);
  }

  fn visit_mut_script(&mut self, script: &mut Script) {
    if !self.check_config(script.span) || has_script_opt_out_directive(&script.body) {
      self.opted_out = true;
      return;
    }
    script.visit_mut_children_with(self);
  }

  fn visit_mut_call_expr(&mut self, call: &mut CallExpr) {
    if self.opted_out {
      return;
    }
    let resolved = match &call.callee {
      Callee::Expr(callee) => self.resolve_declaration(self.resolve_expr_identity(callee)),
      _ => None,
    };
    call.visit_mut_children_with(self);
    if let Some(resolved) = resolved {
      self.apply_call_declaration(call, &resolved);
    }
  }

  fn visit_mut_jsx_element(&mut self, element: &mut JSXElement) {
    if self.opted_out {
      return;
    }
    let resolved = self.resolve_declaration(self.resolve_jsx_identity(&element.opening.name));
    element.visit_mut_children_with(self);
    if let Some(resolved) = resolved {
      self.apply_jsx_declaration(element, &resolved);
    }
  }
}

pub fn take_sorted_records(
  collector: &DirectiveInferenceCollector,
) -> Vec<DirectiveInferenceRecord> {
  let mut records = collector.borrow_mut().drain(..).collect::<Vec<_>>();
  records.sort_by(|left, right| {
    (
      &left.filename,
      left.start,
      left.end,
      &left.package,
      &left.source,
      &left.export,
      &left.path,
    )
      .cmp(&(
        &right.filename,
        right.start,
        right.end,
        &right.package,
        &right.source,
        &right.export,
        &right.path,
      ))
  });
  records.dedup();
  records
}

fn directive_statement(span: Span) -> Stmt {
  ExprStmt {
    span,
    expr: Box::new(Expr::Lit(Lit::Str(Str {
      span,
      value: INFERRED_DIRECTIVE.into(),
      raw: None,
    }))),
  }
  .into()
}

fn prepend_directive(block: &mut BlockStmt, span: Span) -> bool {
  if block.stmts.first().is_some_and(|statement| {
    matches!(
      statement,
      Stmt::Expr(ExprStmt {
        expr,
        ..
      }) if matches!(
        expr.as_ref(),
        Expr::Lit(Lit::Str(value))
          if value.value == INFERRED_DIRECTIVE || value.value == "main-thread"
      )
    )
  }) {
    return false;
  }
  block.stmts.insert(0, directive_statement(span));
  true
}

fn unwrap_transparent_expr(expr: &mut Box<Expr>) -> &mut Expr {
  match expr.as_mut() {
    Expr::Paren(paren) => unwrap_transparent_expr(&mut paren.expr),
    Expr::TsAs(value) => unwrap_transparent_expr(&mut value.expr),
    Expr::TsSatisfies(value) => unwrap_transparent_expr(&mut value.expr),
    Expr::TsTypeAssertion(value) => unwrap_transparent_expr(&mut value.expr),
    Expr::TsConstAssertion(value) => unwrap_transparent_expr(&mut value.expr),
    Expr::TsNonNull(value) => unwrap_transparent_expr(&mut value.expr),
    value => value,
  }
}

fn static_member_property(property: &MemberProp) -> Option<String> {
  match property {
    MemberProp::Ident(ident) => Some(ident.sym.to_string()),
    MemberProp::Computed(computed) => match computed.expr.as_ref() {
      Expr::Lit(Lit::Str(value)) => Some(value.value.to_string_lossy().into_owned()),
      Expr::Lit(Lit::Num(value)) => Some(value.value.to_string()),
      _ => None,
    },
    MemberProp::PrivateName(_) => None,
  }
}

fn static_property_name(name: &PropName) -> Option<String> {
  match name {
    PropName::Ident(ident) => Some(ident.sym.to_string()),
    PropName::Str(value) => Some(value.value.to_string_lossy().into_owned()),
    PropName::Num(value) => Some(value.value.to_string()),
    PropName::BigInt(value) => Some(value.value.to_string()),
    PropName::Computed(_) => None,
  }
}

fn is_absent_value(expr: &Expr) -> bool {
  matches!(expr, Expr::Lit(Lit::Null(_)))
    || matches!(expr, Expr::Ident(ident) if ident.sym == "undefined")
}

fn is_primitive_value(expr: &Expr) -> bool {
  matches!(expr, Expr::Lit(_)) || is_absent_value(expr)
}

fn has_opt_out_directive(body: &[ModuleItem]) -> bool {
  body
    .iter()
    .map_while(|item| match item {
      ModuleItem::Stmt(statement) => directive_value(statement),
      ModuleItem::ModuleDecl(_) => None,
    })
    .any(|value| value == OPT_OUT_DIRECTIVE)
}

fn has_script_opt_out_directive(body: &[Stmt]) -> bool {
  body
    .iter()
    .map_while(directive_value)
    .any(|value| value == OPT_OUT_DIRECTIVE)
}

fn directive_value(statement: &Stmt) -> Option<&str> {
  match statement {
    Stmt::Expr(ExprStmt { expr, .. }) => match expr.as_ref() {
      Expr::Lit(Lit::Str(value)) => value.value.as_str(),
      _ => None,
    },
    _ => None,
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::{Arc, Mutex};
  use swc_core::{
    common::{
      errors::{DiagnosticBuilder, Emitter as DiagnosticEmitter, Handler},
      sync::Lrc,
      FileName, FilePathMapping, Mark, SourceMap, GLOBALS,
    },
    ecma::{
      codegen::{self, text_writer::JsWriter, Emitter},
      parser::{Parser, StringInput, Syntax, TsSyntax},
      transforms::base::{hygiene::hygiene, resolver},
      visit::VisitMutWith,
    },
  };

  fn config() -> DirectiveInferenceConfig {
    serde_json::from_value(serde_json::json!({
      "protocolVersion": 1,
      "modules": [
        {
          "source": "fake-functions",
          "package": "fake-functions",
          "packageVersion": "1.2.3",
          "manifest": "fake-functions/package.json#protocol",
          "exports": {
            "consume": { "args": { "0": true } },
            "default": { "args": { "1": { "nested": "**" } } },
            "namespace.consume": { "args": { "0": "*" } },
            "widgets.Panel": {
              "props": {
                "callback": true,
                "options": { "items": "**" }
              }
            },
            "mark": { "marker": true }
          }
        },
        {
          "source": "phase-functions",
          "package": "phase-functions",
          "packageVersion": "1.0.0",
          "manifest": "phase-functions/package.json#protocol",
          "exports": {
            "default": { "args": { "0": true } },
            "namespace.consume": { "args": { "0": true } }
          }
        }
      ]
    }))
    .unwrap()
  }

  fn transform(source: &str) -> (String, Vec<DirectiveInferenceRecord>) {
    let (output, records, diagnostics) = transform_with_diagnostics(source);
    assert!(
      diagnostics.is_empty(),
      "unexpected transform diagnostics: {diagnostics:?}"
    );
    (output, records)
  }

  fn transform_with_diagnostics(
    source: &str,
  ) -> (String, Vec<DirectiveInferenceRecord>, Vec<String>) {
    struct DiagnosticCollector {
      messages: Arc<Mutex<Vec<String>>>,
    }

    impl DiagnosticEmitter for DiagnosticCollector {
      fn emit(&mut self, diagnostic: &mut DiagnosticBuilder<'_>) {
        self
          .messages
          .lock()
          .unwrap()
          .push(diagnostic.message().to_string());
      }
    }

    let cm = Lrc::new(SourceMap::new(FilePathMapping::empty()));
    let file = cm.new_source_file(
      FileName::Custom("input.tsx".into()).into(),
      source.to_string(),
    );
    let diagnostics = Arc::new(Mutex::new(vec![]));
    let handler = Handler::with_emitter(
      true,
      false,
      Box::new(DiagnosticCollector {
        messages: diagnostics.clone(),
      }),
    );
    let mut parser = Parser::new(
      Syntax::Typescript(TsSyntax {
        tsx: true,
        ..Default::default()
      }),
      StringInput::from(&*file),
      None,
    );
    let mut module = parser.parse_module().unwrap();
    let collector = Rc::new(RefCell::new(vec![]));
    GLOBALS.set(&Default::default(), || {
      HANDLER.set(&handler, || {
        let unresolved_mark = Mark::new();
        let top_level_mark = Mark::new();
        module.visit_mut_with(&mut resolver(unresolved_mark, top_level_mark, true));
        module.visit_mut_with(
          &mut DirectiveInferenceVisitor::new(config(), "input.tsx".into())
            .with_collector(collector.clone())
            .with_file_start(file.start_pos.0),
        );
        module.visit_mut_with(&mut hygiene());
      });
    });

    let mut output = vec![];
    {
      let mut emitter = Emitter {
        cfg: codegen::Config::default(),
        comments: None,
        cm: cm.clone(),
        wr: JsWriter::new(cm, "\n", &mut output, None),
      };
      emitter.emit_module(&module).unwrap();
    }
    let diagnostics = diagnostics.lock().unwrap().clone();
    (
      String::from_utf8(output).unwrap(),
      take_sorted_records(&collector),
      diagnostics,
    )
  }

  #[test]
  fn infers_named_default_namespace_and_marker_calls() {
    let (output, records) = transform(
      r#"
        import receiver, {
          consume as renamed,
          mark as tagged,
        } from "fake-functions";
        import * as functions from "fake-functions";
        renamed((value) => value * 2);
        receiver(0, { nested: [() => 1, { deep() { return 2 } }] });
        functions.namespace.consume([() => 3, function () { return 4 }]);
        tagged(() => 5);
      "#,
    );

    assert_eq!(output.matches("\"main thread\"").count(), 6);
    assert_eq!(records.len(), 6);
    assert_eq!(
      records
        .iter()
        .map(|record| record.path.as_str())
        .collect::<Vec<_>>(),
      vec![
        "args.0",
        "args.1.nested.0",
        "args.1.nested.1.deep",
        "args.0.0",
        "args.0.1",
        "marker.0",
      ]
    );
  }

  #[test]
  fn infers_aliased_jsx_props_and_nested_literals() {
    let (output, records) = transform(
      r#"
        import { widgets as view } from "fake-functions";
        const node = (
          <view.Panel
            callback={(value) => value}
            options={{ items: [() => 1, { finish() { return 2 } }] }}
          />
        );
      "#,
    );

    assert_eq!(output.matches("\"main thread\"").count(), 3);
    assert_eq!(
      records
        .iter()
        .map(|record| record.path.as_str())
        .collect::<Vec<_>>(),
      vec![
        "props.callback",
        "props.options.items.0",
        "props.options.items.1.finish",
      ]
    );
  }

  #[test]
  fn respects_shadowing_and_file_opt_out() {
    let (shadowed, records) = transform(
      r#"
        import { consume } from "fake-functions";
        function local(consume: (value: unknown) => unknown) {
          consume(() => "local");
        }
        consume(() => "imported");
      "#,
    );
    assert_eq!(shadowed.matches("\"main thread\"").count(), 1);
    assert_eq!(records.len(), 1);

    let (opted_out, records) = transform(
      r#"
        "use strict";
        "use no main thread";
        import { consume } from "fake-functions";
        consume(() => "plain");
      "#,
    );
    assert!(!opted_out.contains("\"main thread\""));
    assert!(records.is_empty());
  }

  #[test]
  fn records_are_deterministic() {
    let source = r#"
      import { consume } from "fake-functions";
      consume(() => 1);
      consume(() => 2);
    "#;
    let first = transform(source);
    let second = transform(source);
    assert_eq!(first, second);
    assert!(first.1.windows(2).all(|pair| pair[0].start < pair[1].start));
  }

  #[test]
  fn records_carry_file_local_offsets() {
    let source = r#"
      import { consume } from "fake-functions";
      consume(() => 1);
      consume(function named() { return 2 });
    "#;
    let (_, records) = transform(source);
    assert_eq!(
      records
        .iter()
        .map(|record| &source[record.start as usize..record.end as usize])
        .collect::<Vec<_>>(),
      vec!["() => 1", "function named() { return 2 }"]
    );
  }

  #[test]
  fn respects_static_import_phases() {
    let (source_output, source_records, source_diagnostics) = transform_with_diagnostics(
      r#"
        import source receiver from "phase-functions";
        receiver(() => 1);
      "#,
    );
    assert!(!source_output.contains("\"main thread\""));
    assert!(source_records.is_empty());
    assert!(source_diagnostics.is_empty());

    let (defer_output, defer_records, defer_diagnostics) = transform_with_diagnostics(
      r#"
        import defer * as functions from "phase-functions";
        functions.namespace.consume(() => 2);
      "#,
    );
    assert_eq!(defer_output.matches("\"main thread\"").count(), 1);
    assert_eq!(defer_records.len(), 1);
    assert_eq!(defer_records[0].export, "namespace.consume");
    assert_eq!(defer_records[0].path, "args.0");
    assert!(defer_diagnostics.is_empty());
  }
}
