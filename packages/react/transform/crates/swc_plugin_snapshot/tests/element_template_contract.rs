use serde_json::Value;
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::Arc;
use swc_core::common::{comments::SingleThreadedComments, FileName, Globals, SourceMap, GLOBALS};
use swc_core::ecma::codegen::{text_writer::JsWriter, Emitter};
use swc_core::ecma::parser::{lexer::Lexer, EsSyntax, Parser, StringInput, Syntax};
use swc_core::ecma::visit::VisitMutWith;
use swc_plugin_snapshot::{ElementTemplateAsset, JSXTransformer, JSXTransformerConfig};
use swc_plugins_shared::transform_mode::TransformMode;

const BUILTIN_RAW_TEXT_TEMPLATE_ID: &str = "__et_builtin_raw_text__";

fn transform_to_templates(input: &str, cfg: JSXTransformerConfig) -> Vec<ElementTemplateAsset> {
  let (templates, _) = transform_fixture(input, cfg);
  templates
}

fn transform_to_code(input: &str, cfg: JSXTransformerConfig) -> String {
  let (_, code) = transform_fixture(input, cfg);
  code
}

fn transform_fixture(
  input: &str,
  cfg: JSXTransformerConfig,
) -> (Vec<ElementTemplateAsset>, String) {
  GLOBALS.set(&Globals::new(), || {
    let cm: Arc<SourceMap> = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(FileName::Anon.into(), input.to_string());
    let comments = SingleThreadedComments::default();

    let lexer = Lexer::new(
      Syntax::Es(EsSyntax {
        jsx: true,
        ..Default::default()
      }),
      Default::default(),
      StringInput::from(&*fm),
      Some(&comments),
    );

    let mut parser = Parser::new_from(lexer);
    let mut module = parser.parse_module().expect("Failed to parse module");
    let element_templates = Rc::new(RefCell::new(vec![]));

    let mut transformer = JSXTransformer::new(
      cfg,
      Some(comments),
      TransformMode::Test,
      Some(element_templates.clone()),
    );

    module.visit_mut_with(&mut transformer);

    let mut sink = vec![];
    let mut emitter = Emitter {
      cfg: swc_core::ecma::codegen::Config::default(),
      cm: cm.clone(),
      comments: None,
      wr: JsWriter::new(cm.clone(), "\n", &mut sink, None),
    };
    emitter.emit_module(&module).expect("Failed to emit module");

    let templates = element_templates.borrow_mut().drain(..).collect();
    (
      templates,
      String::from_utf8(sink).expect("transform output should be valid utf8"),
    )
  })
}

fn first_user_template_json(input: &str) -> Value {
  first_user_template_json_with_cfg(
    input,
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
  )
}

fn first_user_template_json_with_cfg(input: &str, cfg: JSXTransformerConfig) -> Value {
  let templates = transform_to_templates(input, cfg);

  templates
    .into_iter()
    .find(|template| template.template_id != BUILTIN_RAW_TEXT_TEMPLATE_ID)
    .map(|template| {
      serde_json::to_value(template.compiled_template).expect("compiled template to json")
    })
    .expect("should collect a user template")
}

#[test]
fn should_not_inject_root_css_scope_attrs_for_element_template() {
  let template = first_user_template_json(
    r#"
      /**
       * @jsxCSSId 100
       */
      <view>
        <text>Hello</text>
      </view>
    "#,
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  assert!(
    attrs
      .iter()
      .all(|attr| attr["key"] != "css-id" && attr["key"] != "entry-name"),
    "root element should no longer carry css scope attrs once metadata moves to options",
  );

  let children = template["children"].as_array().expect("children array");
  let first_child_attrs = children[0]["attributesArray"]
    .as_array()
    .expect("child attributesArray");
  assert!(
    first_child_attrs
      .iter()
      .all(|attr| attr["key"] != "css-id" && attr["key"] != "entry-name"),
    "nested static elements should not receive css scope attrs",
  );
}

#[test]
fn should_not_inject_root_entry_name_attr_for_dynamic_component_element_template() {
  let template = first_user_template_json_with_cfg(
    r#"
      /**
       * @jsxCSSId 100
       */
      <view id={dynamicId}>
        <text>Hello</text>
      </view>
    "#,
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      is_dynamic_component: Some(true),
      ..Default::default()
    },
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  assert!(
    attrs
      .iter()
      .all(|attr| attr["key"] != "entry-name" && attr["key"] != "css-id"),
    "dynamic component root should no longer encode css scope metadata in attrs",
  );
}

#[test]
fn should_keep_slot_descriptor_order_for_dynamic_attr_spread_event_and_ref() {
  let template = first_user_template_json(
    r#"
      <view id={dynamicId} {...props} bindtap={handleTap} ref={viewRef} />
    "#,
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  assert_eq!(attrs.len(), 4);

  assert_eq!(attrs[0]["kind"], "attribute");
  assert_eq!(attrs[0]["key"], "id");
  assert_eq!(attrs[0]["binding"], "slot");
  assert_eq!(attrs[0]["attrSlotIndex"].as_f64(), Some(0.0));

  assert_eq!(attrs[1]["kind"], "spread");
  assert_eq!(attrs[1]["binding"], "slot");
  assert_eq!(attrs[1]["attrSlotIndex"].as_f64(), Some(1.0));

  assert_eq!(attrs[2]["kind"], "attribute");
  assert_eq!(attrs[2]["key"], "bindtap");
  assert_eq!(attrs[2]["binding"], "slot");
  assert_eq!(attrs[2]["attrSlotIndex"].as_f64(), Some(2.0));

  assert_eq!(attrs[3]["kind"], "attribute");
  assert_eq!(attrs[3]["key"], "ref");
  assert_eq!(attrs[3]["binding"], "slot");
  assert_eq!(attrs[3]["attrSlotIndex"].as_f64(), Some(3.0));
}

#[test]
fn should_keep_element_slot_indices_stable_for_mixed_dynamic_children() {
  let template = first_user_template_json(
    r#"
      <view>
        <text>static</text>
        {first}
        <image />
        {second}
      </view>
    "#,
  );

  let children = template["children"].as_array().expect("children array");
  assert_eq!(children[0]["kind"], "element");
  assert_eq!(children[0]["tag"], "text");
  assert_eq!(children[1]["kind"], "elementSlot");
  assert_eq!(children[1]["elementSlotIndex"].as_f64(), Some(0.0));
  assert_eq!(children[1]["tag"], "slot");
  assert_eq!(children[2]["kind"], "element");
  assert_eq!(children[2]["tag"], "image");
  assert_eq!(children[3]["kind"], "elementSlot");
  assert_eq!(children[3]["elementSlotIndex"].as_f64(), Some(1.0));
  assert_eq!(children[3]["tag"], "slot");
}

#[test]
fn should_collect_element_template_assets_for_list_children_in_et_mode() {
  let templates = transform_to_templates(
    r#"
      <view>
        <list>
          {items.map((item) => (
            <list-item item-key={item.id}>
              <text>{item.name}</text>
            </list-item>
          ))}
        </list>
      </view>
    "#,
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
  );

  assert!(
    templates.len() >= 3,
    "expected root, list-item, and list templates to be collected, got {}",
    templates.len()
  );

  let template_jsons: Vec<_> = templates
    .iter()
    .map(|template| {
      serde_json::to_value(&template.compiled_template).expect("compiled template to json")
    })
    .collect();

  let list_template = template_jsons
    .iter()
    .find_map(find_list_node)
    .unwrap_or_else(|| {
      let template_tags: Vec<_> = template_jsons
        .iter()
        .map(|template| template["tag"].as_str().unwrap_or("<unknown>").to_string())
        .collect();
      panic!(
        "should collect a list element in compiled templates, got root tags: {template_tags:?}"
      );
    });

  let list_children = list_template["children"]
    .as_array()
    .expect("list children array");
  assert_eq!(
    list_children.len(),
    1,
    "list should expose one element slot for dynamic children"
  );
  assert_eq!(list_children[0]["kind"], "elementSlot");
  assert_eq!(list_children[0]["tag"], "slot");
  assert_eq!(list_children[0]["elementSlotIndex"].as_f64(), Some(0.0));
}

#[test]
fn should_not_opt_deferred_list_item_trees_into_et_list_fast_path() {
  let code = transform_to_code(
    r#"
      <view>
        <list>
          <list-item defer item-key="Ada">
            <text>Ada</text>
          </list-item>
        </list>
      </view>
    "#,
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
  );

  assert!(
    !code.contains("__elementTemplateList: true"),
    "deferred list-item trees should not be marked for ET list fast-path, got: {code}"
  );
}

#[test]
fn should_keep_et_list_fast_path_for_list_item_defer_false() {
  let code = transform_to_code(
    r#"
      <view>
        <list>
          <list-item defer={false} item-key="Ada">
            <text>Ada</text>
          </list-item>
        </list>
      </view>
    "#,
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
  );

  assert!(
    code.contains("__elementTemplateList: true"),
    "non-deferred list-item trees should keep ET list fast-path, got: {code}"
  );
}

#[test]
fn should_not_keep_et_list_fast_path_for_list_item_defer_string_literal() {
  let code = transform_to_code(
    r#"
      <view>
        <list>
          <list-item defer="false" item-key="Ada">
            <text>Ada</text>
          </list-item>
        </list>
      </view>
    "#,
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
  );

  assert!(
    !code.contains("__elementTemplateList: true"),
    "string-literal defer should match deferred list-item semantics, got: {code}"
  );
}

#[test]
fn should_not_keep_et_list_fast_path_for_list_root_spread_props() {
  let code = transform_to_code(
    r#"
      <view>
        <list {...props}>
          <list-item item-key="Ada">
            <text>Ada</text>
          </list-item>
        </list>
      </view>
    "#,
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
  );

  assert!(
    !code.contains("__elementTemplateList: true"),
    "list roots with spread props should not keep the ET list fast-path, got: {code}"
  );
}

fn find_list_node<'a>(value: &'a Value) -> Option<&'a Value> {
  if value["tag"] == "list" {
    return Some(value);
  }

  value["children"]
    .as_array()
    .and_then(|children| children.iter().find_map(find_list_node))
}
