use once_cell::sync::Lazy;
use serde::Deserialize;
use std::{cell::RefCell, rc::Rc};
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
mod slot;
mod template_attribute;
mod template_definition;
mod template_slot;

pub use self::asset::ElementTemplateAsset;
use self::extractor::{ElementTemplateExtractor, ExtractedTemplateParts};
use self::lowering::LoweredRuntimeJsx;
use self::template_slot::ET_SLOT_PLACEHOLDER_TAG;

#[derive(Clone, Debug, Deserialize)]
pub struct UISourceMapRecord {
  pub ui_source_map: i32,
  pub line_number: u32,
  pub column_number: u32,
  pub template_id: String,
}

pub type ElementTemplateTransformerConfig = JSXTransformerConfig;
pub type ElementTemplateTransformer<C> = JSXTransformer<C>;
pub type ElementTemplateUISourceMapRecord = UISourceMapRecord;

#[cfg(feature = "napi")]
pub mod napi;

use swc_plugins_shared::{
  jsx_helpers::jsx_name,
  target::TransformTarget,
  transform_mode::TransformMode,
  utils::{calc_hash, calc_hash_number},
};

pub fn i32_to_expr(i: &i32) -> Expr {
  Expr::Lit(Lit::Num(Number {
    span: DUMMY_SP,
    value: *i as f64,
    raw: None,
  }))
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
  /// @internal
  #[serde(default)]
  pub enable_ui_source_map: bool,
  /// @internal
  pub is_dynamic_component: Option<bool>,
}

impl Default for JSXTransformerConfig {
  fn default() -> Self {
    Self {
      preserve_jsx: false,
      runtime_pkg: "@lynx-js/react".into(),
      jsx_import_source: Some("@lynx-js/react".into()),
      filename: Default::default(),
      target: TransformTarget::LEPUS,
      enable_ui_source_map: false,
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
  filename_hash: String,
  pub content_hash: String,
  runtime_id: Lazy<Expr>,
  pub element_templates: Option<Rc<RefCell<Vec<ElementTemplateAsset>>>>,
  template_counter: u32,
  current_template_defs: Vec<ModuleItem>,
  comments: Option<C>,
  slot_ident: Ident,
  used_slot: bool,
  pub ui_source_map_records: Rc<RefCell<Vec<UISourceMapRecord>>>,
  pub source_map: Option<Lrc<SourceMap>>,
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
    source_map: Option<Lrc<SourceMap>>,
    element_templates: Option<Rc<RefCell<Vec<ElementTemplateAsset>>>>,
  ) -> Self {
    JSXTransformer {
      filename_hash: calc_hash(&cfg.filename.clone()),
      content_hash: "test".into(),
      runtime_id: match mode {
        TransformMode::Development => {
          // We should find a way to use `cfg.runtime_pkg`
          Lazy::new(|| quote!("require('@lynx-js/react/internal')" as Expr))
        }
        TransformMode::Production | TransformMode::Test => {
          Lazy::new(|| Expr::Ident(private_ident!("ReactLynx")))
        }
      },
      element_templates,
      cfg,
      template_counter: 0,
      current_template_defs: vec![],
      comments,
      slot_ident: private_ident!("__etSlot"),
      used_slot: false,
      ui_source_map_records: Rc::new(RefCell::new(vec![])),
      source_map,
    }
  }

  fn validate_directives(&self, span: Span) {
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
          loop {
            let pragma = words.next();
            if pragma.is_none() {
              break;
            }
            let val = words.next();
            if let Some("@jsxCSSId") = pragma {
              if let Some(css_id) = val {
                css_id.parse::<f64>().expect("should have numeric cssId");
              }
            }
          }
        }
      }
    });
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
          if tag_str == "page" || tag_str == "component" {
            HANDLER.with(|handler| {
              handler
                .struct_span_err(
                  node.opening.name.span(),
                  &format!("<{tag_str} /> is not supported"),
                )
                .emit()
            });
          }
        }
      }
      _ => {
        return node.visit_mut_children_with(self);
      }
    }

    self.template_counter += 1;
    let template_uid = format!(
      "{}_{}_{}_{}",
      "_et", self.filename_hash, self.content_hash, self.template_counter
    );
    let template_ident = Ident::new(
      template_uid.clone().into(),
      DUMMY_SP,
      SyntaxContext::default().apply_mark(Mark::fresh(Mark::root())),
    );

    let target = self.cfg.target;
    let runtime_id = self.runtime_id.clone();
    let filename_hash = self.filename_hash.clone();
    let content_hash = self.content_hash.clone();
    let ui_source_map_records = self.ui_source_map_records.clone();
    let template_uid_for_captured = template_uid.clone();
    let source_map = self.source_map.clone();
    let node_index_fn = move |span: Span| {
      let ui_source_map =
        calc_hash_number(&format!("{}:{}:{}", filename_hash, content_hash, span.lo.0));

      let mut line_number = 0;
      let mut column_number = 0;
      if span.lo.0 > 0 {
        if let Some(cm) = &source_map {
          let loc = cm.lookup_char_pos(span.lo);
          line_number = loc.line as u32;
          column_number = loc.col.0 as u32 + 1;
        }
      }

      ui_source_map_records.borrow_mut().push(UISourceMapRecord {
        ui_source_map,
        line_number,
        column_number,
        template_id: template_uid_for_captured.clone(),
      });

      Expr::Lit(Lit::Num(Number {
        span: DUMMY_SP,
        value: ui_source_map as f64,
        raw: None,
      }))
    };
    let ExtractedTemplateParts {
      key,
      dynamic_attrs,
      dynamic_attr_slots,
      dynamic_children,
    } = {
      let mut extractor =
        ElementTemplateExtractor::new(self, self.cfg.enable_ui_source_map, node_index_fn);

      node.visit_mut_with(&mut extractor);
      extractor.into_extracted_template_parts()
    };

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

    let mut entry_template_uid = quote!("$template_uid" as Expr, template_uid: Expr = Expr::Lit(Lit::Str(template_uid.clone().into())));
    if matches!(self.cfg.is_dynamic_component, Some(true)) {
      entry_template_uid = quote!("`${globDynamicComponentEntry}:${$template_uid}`" as Expr, template_uid: Expr = Expr::Lit(Lit::Str(template_uid.clone().into())));
    }

    let entry_template_uid_def = ModuleItem::Stmt(quote!(
        r#"const $template_ident = $entry_template_uid"#
            as Stmt,
        template_ident = template_ident.clone(),
        entry_template_uid: Expr = entry_template_uid.clone(),
    ));
    self.current_template_defs.push(entry_template_uid_def);

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

    // TODO(element-template): reintroduce cssId/entryName metadata once the
    // runtime/native contract grows a dedicated replacement channel.

    if let Some(element_templates) = &self.element_templates {
      element_templates.borrow_mut().push(ElementTemplateAsset {
        template_id: template_uid.clone(),
        compiled_template,
        source_file: self.cfg.filename.clone(),
      });
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
    self.validate_directives(n.span);
    for item in &n.body {
      let span = item.span();
      self.validate_directives(span);
    }

    n.visit_mut_children_with(self);
    self.ensure_builtin_element_templates();
    if let Some(Expr::Ident(runtime_id)) = Lazy::<Expr>::get(&self.runtime_id) {
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

    if self.used_slot {
      prepend_stmt(
        &mut n.body,
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
          span: DUMMY_SP,
          specifiers: vec![ImportSpecifier::Named(ImportNamedSpecifier {
            span: DUMMY_SP,
            local: self.slot_ident.clone(),
            imported: Some(ModuleExportName::Ident(Ident::new(
              "__etSlot".into(),
              DUMMY_SP,
              SyntaxContext::default(),
            ))),
            is_type_only: false,
          })],
          src: Box::new(Str {
            span: DUMMY_SP,
            raw: None,
            value: self.cfg.runtime_pkg.clone().into(),
          }),
          type_only: Default::default(),
          with: Default::default(),
          phase: ImportPhase::Evaluation,
        })),
      );
    }
  }
}
