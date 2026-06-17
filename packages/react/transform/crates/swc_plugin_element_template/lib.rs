use once_cell::sync::Lazy;
use serde::Deserialize;
use std::{cell::RefCell, collections::HashMap, rc::Rc};
use swc_core::{
  common::{
    comments::{CommentKind, Comments},
    errors::HANDLER,
    sync::Lrc,
    util::take::Take,
    Mark, SourceMap, Span, Spanned, SyntaxContext, DUMMY_SP,
  },
  ecma::{
    ast::*,
    utils::{prepend_stmt, private_ident},
    visit::{VisitMut, VisitMutWith},
  },
  quote,
};

mod asset;
mod attr_name;
mod extractor;
mod lowering;
mod template_attribute;
mod template_definition;
mod template_identity;
mod template_slot;

pub use self::asset::ElementTemplateAsset;
use self::attr_name::AttrName;
use self::extractor::{DynamicAttributePart, ElementTemplateExtractor, ExtractedTemplateParts};
use self::lowering::LoweredRuntimeJsx;
use self::template_attribute::template_attribute_descriptor_key;
use self::template_identity::{
  template_identity_from_compiled_template, TemplateIdentityCollisionGuard,
};
use self::template_slot::ET_SLOT_PLACEHOLDER_TAG;

pub type ElementTemplateTransformerConfig = JSXTransformerConfig;
pub type ElementTemplateTransformer<C> = JSXTransformer<C>;
type RuntimeIdInitializer = Box<dyn FnOnce() -> Expr>;

#[cfg(feature = "napi")]
pub mod napi;

use swc_plugins_shared::{
  jsx_helpers::{jsx_attr_value, jsx_children_to_expr, jsx_is_list_item, jsx_name},
  target::TransformTarget,
  transform_mode::TransformMode,
};

pub fn i32_to_expr(i: &i32) -> Expr {
  Expr::Lit(Lit::Num(Number {
    span: DUMMY_SP,
    value: *i as f64,
    raw: None,
  }))
}

fn lazy_runtime_id(init: impl FnOnce() -> Expr + 'static) -> Lazy<Expr, RuntimeIdInitializer> {
  Lazy::new(Box::new(init))
}

fn require_runtime_id(runtime_pkg: String) -> Lazy<Expr, RuntimeIdInitializer> {
  lazy_runtime_id(move || {
    Expr::Call(CallExpr {
      ctxt: SyntaxContext::default(),
      span: DUMMY_SP,
      callee: Callee::Expr(Box::new(Expr::Ident(
        IdentName::new("require".into(), DUMMY_SP).into(),
      ))),
      args: vec![ExprOrSpread {
        spread: None,
        expr: Box::new(Expr::Lit(Lit::Str(Str {
          span: DUMMY_SP,
          value: runtime_pkg.into(),
          raw: None,
        }))),
      }],
      type_args: None,
    })
  })
}

fn jsx_expr_attr(name: &str, expr: Expr) -> JSXAttrOrSpread {
  JSXAttrOrSpread::JSXAttr(JSXAttr {
    span: DUMMY_SP,
    name: JSXAttrName::Ident(IdentName::new(name.into(), DUMMY_SP)),
    value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
      span: DUMMY_SP,
      expr: JSXExpr::Expr(Box::new(expr)),
    })),
  })
}

fn jsx_attr_to_template_object_prop(attr: &JSXAttr) -> PropOrSpread {
  let key = template_attribute_descriptor_key(&attr.name);
  PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
    key: PropName::Str(Str {
      span: attr.span,
      raw: None,
      value: key.into(),
    }),
    value: jsx_attr_value(attr.value.clone()),
  })))
}

fn empty_array_expr() -> Expr {
  Expr::Array(ArrayLit {
    span: DUMMY_SP,
    elems: vec![],
  })
}

fn empty_object_expr() -> Expr {
  Expr::Object(ObjectLit {
    span: DUMMY_SP,
    props: vec![],
  })
}

fn typed_list_attributes_expr(attrs: Vec<JSXAttrOrSpread>) -> (Vec<JSXAttrOrSpread>, Expr) {
  let mut passthrough_attrs = vec![];
  let mut object_props = vec![];

  for attr in attrs {
    match attr {
      JSXAttrOrSpread::JSXAttr(attr) if matches!(&attr.name, JSXAttrName::Ident(name) if name.sym.as_ref() == "key") =>
      {
        passthrough_attrs.push(JSXAttrOrSpread::JSXAttr(attr));
      }
      JSXAttrOrSpread::JSXAttr(attr) => object_props.push(jsx_attr_to_template_object_prop(&attr)),
      JSXAttrOrSpread::SpreadElement(spread) => object_props.push(PropOrSpread::Spread(spread)),
      #[cfg(swc_ast_unknown)]
      _ => panic!("unknown node"),
    }
  }

  (
    passthrough_attrs,
    Expr::Object(ObjectLit {
      span: DUMMY_SP,
      props: object_props,
    }),
  )
}

fn is_list_item_platform_attr_key(key: &str) -> bool {
  matches!(
    key,
    "reuse-identifier"
      | "full-span"
      | "item-key"
      | "sticky-top"
      | "sticky-bottom"
      | "estimated-height"
      | "estimated-height-px"
      | "estimated-main-axis-size-px"
      | "recyclable"
  )
}

fn list_item_platform_info_expr(attrs: &[JSXAttrOrSpread]) -> Option<Expr> {
  let mut props = vec![];

  for attr in attrs {
    match attr {
      JSXAttrOrSpread::JSXAttr(attr) => {
        let key = template_attribute_descriptor_key(&attr.name);
        if is_list_item_platform_attr_key(&key) {
          props.push(jsx_attr_to_template_object_prop(attr));
        }
      }
      JSXAttrOrSpread::SpreadElement(spread) => {
        props.push(PropOrSpread::Spread(spread.clone()));
      }
      #[cfg(swc_ast_unknown)]
      _ => panic!("unknown node"),
    }
  }

  (!props.is_empty()).then_some(Expr::Object(ObjectLit {
    span: DUMMY_SP,
    props,
  }))
}

fn internal_runtime_pkg(runtime_pkg: &str) -> String {
  const INTERNAL_SUFFIXES: &[&str] = &[
    "/internal",
    "/internal.ts",
    "/internal.js",
    "/internal.mjs",
    "/internal.cjs",
  ];
  if INTERNAL_SUFFIXES
    .iter()
    .any(|suffix| runtime_pkg.ends_with(suffix))
  {
    runtime_pkg.to_string()
  } else {
    format!("{runtime_pkg}/internal")
  }
}

/// @internal
#[derive(Deserialize, PartialEq, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct JSXTransformerConfig {
  /// @internal
  pub preserve_jsx: bool,
  /// @internal
  pub runtime_pkg: String,
  /// @internal
  pub jsx_import_source: Option<String>,
  /// @internal
  pub filename: String,
  /// @internal
  pub target: TransformTarget,
  pub is_dynamic_component: Option<bool>,
}

impl Default for JSXTransformerConfig {
  fn default() -> Self {
    Self {
      preserve_jsx: false,
      // Keep the authored runtime package stable. rspeedy aliases
      // `@lynx-js/react` to the ET entry when Element Template is enabled.
      runtime_pkg: "@lynx-js/react".into(),
      jsx_import_source: Some("@lynx-js/react".into()),
      filename: Default::default(),
      target: TransformTarget::LEPUS,
      is_dynamic_component: Some(false),
    }
  }
}

pub struct JSXTransformer<C>
where
  C: Comments + Clone,
{
  // react_transformer: Box<dyn Fold>,
  cfg: JSXTransformerConfig,
  pub content_hash: String,
  runtime_id: Lazy<Expr, RuntimeIdInitializer>,
  internal_runtime_id: Lazy<Expr, RuntimeIdInitializer>,
  pub element_templates: Option<Rc<RefCell<Vec<ElementTemplateAsset>>>>,
  template_idents_by_canonical_content: HashMap<String, Ident>,
  attr_plan_signatures_by_canonical_content: HashMap<String, String>,
  template_identity_collision_guard: TemplateIdentityCollisionGuard,
  current_template_defs: Vec<ModuleItem>,
  comments: Option<C>,
  css_id_value: Option<f64>,
}

impl<C> JSXTransformer<C>
where
  C: Comments + Clone,
{
  pub fn with_content_hash(mut self, content_hash: String) -> Self {
    self.content_hash = content_hash;
    self
  }

  pub fn new(
    cfg: JSXTransformerConfig,
    comments: Option<C>,
    mode: TransformMode,
    source_map: Option<Lrc<SourceMap>>,
  ) -> Self {
    Self::new_with_element_templates(cfg, comments, mode, source_map, None)
  }

  pub fn new_with_element_templates(
    cfg: JSXTransformerConfig,
    comments: Option<C>,
    mode: TransformMode,
    _source_map: Option<Lrc<SourceMap>>,
    element_templates: Option<Rc<RefCell<Vec<ElementTemplateAsset>>>>,
  ) -> Self {
    JSXTransformer {
      content_hash: "test".into(),
      runtime_id: match mode {
        TransformMode::Development => {
          let runtime_pkg = cfg.runtime_pkg.clone();
          require_runtime_id(runtime_pkg)
        }
        TransformMode::Production | TransformMode::Test => {
          lazy_runtime_id(|| Expr::Ident(private_ident!("ReactLynx")))
        }
      },
      internal_runtime_id: match mode {
        TransformMode::Development => {
          let runtime_pkg = internal_runtime_pkg(&cfg.runtime_pkg);
          require_runtime_id(runtime_pkg)
        }
        TransformMode::Production | TransformMode::Test => {
          lazy_runtime_id(|| Expr::Ident(private_ident!("ReactLynxInternal")))
        }
      },
      element_templates,
      cfg,
      template_idents_by_canonical_content: HashMap::new(),
      attr_plan_signatures_by_canonical_content: HashMap::new(),
      template_identity_collision_guard: TemplateIdentityCollisionGuard::default(),
      current_template_defs: vec![],
      comments,
      css_id_value: None,
    }
  }

  fn parse_directives(&mut self, span: Span) {
    self.comments.with_leading(span.lo, |comments| {
      for cmt in comments {
        if cmt.kind != CommentKind::Block {
          continue;
        }
        for line in cmt.text.lines() {
          let mut line = line.trim();
          if line.starts_with('*') {
            line = line[1..].trim();
          }

          if !line.starts_with("@jsx") {
            continue;
          }

          let mut words = line.split_whitespace();
          while let Some(pragma) = words.next() {
            let Some(value) = words.next() else {
              continue;
            };
            if pragma != "@jsxCSSId" {
              continue;
            }
            match value.parse::<f64>() {
              Ok(css_id) if css_id.is_finite() => {
                self.css_id_value = Some(css_id);
              }
              Ok(_) | Err(_) => {
                HANDLER.with(|handler| {
                  handler
                    .struct_span_err(
                      span,
                      &format!("@jsxCSSId must be a finite number, got `{value}`"),
                    )
                    .emit()
                });
              }
            }
          }
        }
      }
    });
  }

  fn lower_typed_list_runtime_jsx(&mut self, node: &mut JSXElement) {
    node.visit_mut_children_with(self);

    let span = node.span();
    let opening_span = node.opening.span;
    let (mut rendered_attrs, attributes) = typed_list_attributes_expr(node.opening.attrs.take());
    let list_children = if node.children.is_empty() {
      empty_array_expr()
    } else {
      jsx_children_to_expr(node.children.take())
    };

    rendered_attrs.push(jsx_expr_attr("attributes", attributes));
    rendered_attrs.push(jsx_expr_attr("$0", list_children));

    let name = JSXElementName::Ident(Ident::new(
      "list".into(),
      DUMMY_SP,
      SyntaxContext::default(),
    ));
    *node = JSXElement {
      span,
      opening: JSXOpeningElement {
        name,
        span: opening_span,
        attrs: rendered_attrs,
        self_closing: true,
        type_args: None,
      },
      children: vec![],
      closing: None,
    };
  }
}

impl<C> VisitMut for JSXTransformer<C>
where
  C: Comments + Clone,
{
  fn visit_mut_jsx_element(&mut self, node: &mut JSXElement) {
    match *jsx_name(node.opening.name.clone()) {
      Expr::Lit(lit) => {
        if let Lit::Str(s) = &lit {
          let tag = s.value.to_string_lossy();
          let tag_str = tag.as_ref();
          if tag_str == ET_SLOT_PLACEHOLDER_TAG {
            return node.visit_mut_children_with(self);
          }
          if tag_str == "list" {
            self.lower_typed_list_runtime_jsx(node);
            return;
          }
          if tag_str == "page" || tag_str == "component" {
            HANDLER.with(|handler| {
              handler
                .struct_span_err(
                  node.opening.name.span(),
                  &format!("<{tag_str} /> is not supported"),
                )
                .emit()
            });
            return;
          }
        }
      }
      _ => {
        return node.visit_mut_children_with(self);
      }
    }
    let is_list_item = jsx_is_list_item(node);

    let target = self.cfg.target;
    let runtime_id = self.runtime_id.clone();
    let ExtractedTemplateParts {
      key,
      dynamic_attrs,
      dynamic_attr_slots,
      dynamic_children,
    } = {
      let has_css_id_value = self.css_id_value.is_some();
      let mut extractor = ElementTemplateExtractor::new(self, has_css_id_value);

      node.visit_mut_with(&mut extractor);
      extractor.into_extracted_template_parts()
    };

    #[derive(Clone, Copy)]
    enum AttrPlanAdapter {
      Event,
      MTEvent,
      Ref,
      Spread,
    }

    let attr_plan_slots = dynamic_attrs
      .iter()
      .filter_map(|dynamic_attr| match dynamic_attr {
        DynamicAttributePart::Attr {
          attr_name: AttrName::Event,
          slot_index,
          ..
        } => Some((*slot_index, AttrPlanAdapter::Event)),
        DynamicAttributePart::Attr {
          attr_name: AttrName::WorkletEvent,
          slot_index,
          ..
        } => Some((*slot_index, AttrPlanAdapter::MTEvent)),
        DynamicAttributePart::Attr {
          attr_name: AttrName::Ref,
          slot_index,
          ..
        } => Some((*slot_index, AttrPlanAdapter::Ref)),
        DynamicAttributePart::Spread { slot_index, .. } => {
          Some((*slot_index, AttrPlanAdapter::Spread))
        }
        _ => None,
      })
      .collect::<Vec<_>>();
    let attr_plan_signature = attr_plan_slots
      .iter()
      .map(|(slot_index, adapter)| {
        let adapter = match adapter {
          AttrPlanAdapter::Event => "event",
          AttrPlanAdapter::MTEvent => "mt-event",
          AttrPlanAdapter::Ref => "ref",
          AttrPlanAdapter::Spread => "spread",
        };
        format!("{slot_index}:{adapter}")
      })
      .collect::<Vec<_>>()
      .join("|");

    let LoweredRuntimeJsx {
      attrs: rendered_attrs,
      children: rendered_children,
    } = self.lower_runtime_jsx(
      target,
      runtime_id.clone(),
      key,
      dynamic_attrs,
      dynamic_children,
    );
    let mut rendered_attrs = rendered_attrs;
    if is_list_item {
      let platform_info =
        list_item_platform_info_expr(&node.opening.attrs).unwrap_or_else(empty_object_expr);
      rendered_attrs.push(jsx_expr_attr("__listItemPlatformInfo", platform_info));
    }

    let mut dynamic_attr_slot_cursor: usize = 0;
    let mut element_slot_index: i32 = 0;
    // Attribute slot indices come from ElementTemplateExtractor so runtime
    // values and Template Definition descriptors share one compile-time source.
    let template_expr = self.element_template_from_jsx_element(
      node,
      &dynamic_attr_slots,
      &mut dynamic_attr_slot_cursor,
      &mut element_slot_index,
    );
    assert_eq!(
      dynamic_attr_slot_cursor,
      dynamic_attr_slots.len(),
      "Template Definition must consume every ET attr slot produced by extractor"
    );
    let compiled_template = self.element_template_to_json(&template_expr);
    let template_identity = template_identity_from_compiled_template(&compiled_template);
    self
      .template_identity_collision_guard
      .register(&template_identity);

    if let Some(existing_signature) = self
      .attr_plan_signatures_by_canonical_content
      .get(&template_identity.canonical_content)
    {
      assert_eq!(
        existing_signature, &attr_plan_signature,
        "Interned ET Template Definition must keep one attr-plan shape for {}",
        template_identity.template_id
      );
    } else {
      self.attr_plan_signatures_by_canonical_content.insert(
        template_identity.canonical_content.clone(),
        attr_plan_signature,
      );
    }

    let mut is_new_template = false;
    let template_ident = match self
      .template_idents_by_canonical_content
      .get(&template_identity.canonical_content)
    {
      Some(template_ident) => template_ident.clone(),
      None => {
        is_new_template = true;
        let template_ident = Ident::new(
          template_identity.template_id.clone().into(),
          DUMMY_SP,
          SyntaxContext::default().apply_mark(Mark::fresh(Mark::root())),
        );
        self.template_idents_by_canonical_content.insert(
          template_identity.canonical_content.clone(),
          template_ident.clone(),
        );
        template_ident
      }
    };
    let template_uid = template_identity.template_id.clone();

    let mut entry_template_uid = quote!("$template_uid" as Expr, template_uid: Expr = Expr::Lit(Lit::Str(template_uid.clone().into())));
    if matches!(self.cfg.is_dynamic_component, Some(true)) {
      entry_template_uid = quote!("`${globDynamicComponentEntry}:${$template_uid}`" as Expr, template_uid: Expr = Expr::Lit(Lit::Str(template_uid.clone().into())));
    }

    if is_new_template {
      let entry_template_uid_def = ModuleItem::Stmt(quote!(
          r#"const $template_ident = $entry_template_uid"#
              as Stmt,
          template_ident = template_ident.clone(),
          entry_template_uid: Expr = entry_template_uid.clone(),
      ));
      self.current_template_defs.push(entry_template_uid_def);
      if !attr_plan_slots.is_empty() {
        let internal_runtime_id = self.internal_runtime_id.clone();
        let mut attr_plan_elements = Vec::with_capacity(attr_plan_slots.len() * 2);
        for (slot_index, adapter) in attr_plan_slots {
          attr_plan_elements.push(Some(ExprOrSpread {
            spread: None,
            expr: Box::new(i32_to_expr(&slot_index)),
          }));
          let adapter_expr = match adapter {
            AttrPlanAdapter::Event => quote!(
              "$internal_runtime_id.adaptEventAttrSlot" as Expr,
              internal_runtime_id: Expr = internal_runtime_id.clone(),
            ),
            AttrPlanAdapter::MTEvent => quote!(
              "$internal_runtime_id.adaptMTEventAttrSlot" as Expr,
              internal_runtime_id: Expr = internal_runtime_id.clone(),
            ),
            AttrPlanAdapter::Ref => quote!(
              "$internal_runtime_id.adaptRefAttrSlot" as Expr,
              internal_runtime_id: Expr = internal_runtime_id.clone(),
            ),
            AttrPlanAdapter::Spread => quote!(
              "$internal_runtime_id.adaptSpreadAttrSlot" as Expr,
              internal_runtime_id: Expr = internal_runtime_id.clone(),
            ),
          };
          attr_plan_elements.push(Some(ExprOrSpread {
            spread: None,
            expr: Box::new(adapter_expr),
          }));
        }

        let attr_plan_expr = Expr::Array(ArrayLit {
          span: DUMMY_SP,
          elems: attr_plan_elements,
        });
        let attr_plan_def = ModuleItem::Stmt(quote!(
            r#"$internal_runtime_id.__etAttrPlanMap[$template_ident] = $attr_plan_expr"#
                as Stmt,
            internal_runtime_id: Expr = internal_runtime_id.clone(),
            template_ident: Expr = Expr::Ident(template_ident.clone()),
            attr_plan_expr: Expr = attr_plan_expr,
        ));
        self.current_template_defs.push(attr_plan_def);
      }

      if let Some(element_templates) = &self.element_templates {
        element_templates.borrow_mut().push(ElementTemplateAsset {
          template_id: template_uid.clone(),
          compiled_template,
          source_file: self.cfg.filename.clone(),
        });
      }
    }

    let rendered_children_is_empty = rendered_children.is_empty();

    *node = JSXElement {
      span: node.span(),
      opening: JSXOpeningElement {
        name: JSXElementName::Ident(template_ident.clone()),
        span: node.span,
        attrs: rendered_attrs,
        self_closing: rendered_children_is_empty,
        type_args: None,
      },
      children: rendered_children,
      closing: if rendered_children_is_empty {
        None
      } else {
        Some(JSXClosingElement {
          name: JSXElementName::Ident(template_ident.clone()),
          span: DUMMY_SP,
        })
      },
    };
  }

  fn visit_mut_module_items(&mut self, n: &mut Vec<ModuleItem>) {
    let mut new_items: Vec<ModuleItem> = vec![];
    for item in n.iter_mut() {
      item.visit_mut_with(self);
      new_items.extend(self.current_template_defs.take());
      new_items.push(item.take());
    }

    *n = new_items;
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    self.parse_directives(n.span);
    for item in &n.body {
      let span = item.span();
      self.parse_directives(span);
    }

    n.visit_mut_children_with(self);
    self.ensure_builtin_element_templates();
    if let Some(Expr::Ident(runtime_id)) = Lazy::get(&self.runtime_id) {
      prepend_stmt(
        &mut n.body,
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
          span: DUMMY_SP,
          specifiers: vec![ImportSpecifier::Namespace(ImportStarAsSpecifier {
            span: DUMMY_SP,
            local: runtime_id.clone(),
          })],
          src: Box::new(Str {
            span: DUMMY_SP,
            raw: None,
            value: self.cfg.runtime_pkg.clone().into(),
          }),
          type_only: Default::default(),
          // asserts: Default::default(),
          with: Default::default(),
          phase: ImportPhase::Evaluation,
        })),
      );
    }
    if let Some(Expr::Ident(internal_runtime_id)) = Lazy::get(&self.internal_runtime_id) {
      prepend_stmt(
        &mut n.body,
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
          span: DUMMY_SP,
          specifiers: vec![ImportSpecifier::Namespace(ImportStarAsSpecifier {
            span: DUMMY_SP,
            local: internal_runtime_id.clone(),
          })],
          src: Box::new(Str {
            span: DUMMY_SP,
            raw: None,
            value: internal_runtime_pkg(&self.cfg.runtime_pkg).into(),
          }),
          type_only: Default::default(),
          with: Default::default(),
          phase: ImportPhase::Evaluation,
        })),
      );
    }
  }
}
