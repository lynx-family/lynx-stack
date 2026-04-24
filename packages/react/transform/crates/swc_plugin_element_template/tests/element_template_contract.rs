use serde_json::Value;
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::Arc;
use swc_core::common::{
  comments::SingleThreadedComments,
  errors::{DiagnosticBuilder, Emitter as DiagnosticEmitter, Handler, HANDLER},
  FileName, Globals, SourceMap, GLOBALS,
};
use swc_core::ecma::codegen::{text_writer::JsWriter, Emitter};
use swc_core::ecma::parser::{lexer::Lexer, EsSyntax, Parser, StringInput, Syntax};
use swc_core::ecma::visit::VisitMutWith;
use swc_plugin_element_template::{ElementTemplateAsset, JSXTransformer, JSXTransformerConfig};
use swc_plugins_shared::transform_mode::TransformMode;

const BUILTIN_RAW_TEXT_TEMPLATE_ID: &str = "__et_builtin_raw_text__";

fn transform_to_templates(input: &str, cfg: JSXTransformerConfig) -> Vec<ElementTemplateAsset> {
  let (templates, _) = transform_fixture(input, cfg);
  templates
}

fn transform_fixture(
  input: &str,
  cfg: JSXTransformerConfig,
) -> (Vec<ElementTemplateAsset>, String) {
  struct DiagnosticCollector;

  impl DiagnosticEmitter for DiagnosticCollector {
    fn emit(&mut self, db: &mut DiagnosticBuilder<'_>) {
      panic!("unexpected transform diagnostic: {}", db.message());
    }
  }

  GLOBALS.set(&Globals::new(), || {
    let cm: Arc<SourceMap> = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(FileName::Anon.into(), input.to_string());
    let comments = SingleThreadedComments::default();
    let handler = Handler::with_emitter(true, false, Box::new(DiagnosticCollector));

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

    let mut transformer = JSXTransformer::new_with_element_templates(
      cfg,
      Some(comments),
      TransformMode::Test,
      None,
      Some(element_templates.clone()),
    );

    HANDLER.set(&handler, || {
      module.visit_mut_with(&mut transformer);
    });

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

fn element_template_config() -> JSXTransformerConfig {
  JSXTransformerConfig {
    preserve_jsx: true,
    ..Default::default()
  }
}

fn dynamic_component_element_template_config() -> JSXTransformerConfig {
  JSXTransformerConfig {
    is_dynamic_component: Some(true),
    ..element_template_config()
  }
}

fn first_user_template_json(input: &str) -> Value {
  first_user_template_json_with_cfg(input, element_template_config())
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

fn first_user_template_json_with_code(input: &str, cfg: JSXTransformerConfig) -> (String, Value) {
  let (templates, code) = transform_fixture(input, cfg);
  let template = templates
    .into_iter()
    .find(|template| template.template_id != BUILTIN_RAW_TEXT_TEMPLATE_ID)
    .map(|template| {
      serde_json::to_value(template.compiled_template).expect("compiled template to json")
    })
    .expect("should collect a user template");

  (code, template)
}

fn without_whitespace(value: &str) -> String {
  value.chars().filter(|ch| !ch.is_whitespace()).collect()
}

#[test]
fn should_not_inject_root_css_scope_attrs_for_element_template() {
  let (code, template) = first_user_template_json_with_code(
    r#"
      /**
       * @jsxCSSId 100
       */
      <view>
        <text>Hello</text>
      </view>
    "#,
    element_template_config(),
  );
  assert!(
    !code.contains("options={{") && !code.contains("cssId"),
    "element template lowering should not emit legacy cssId create metadata, got: {code}"
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
fn should_preserve_text_children_when_text_attr_is_explicit() {
  let template = first_user_template_json(
    r#"
      <view>
        <text text="Explicit Text Attribute">Child Text</text>
      </view>
    "#,
  );

  let text_node = &template["children"]
    .as_array()
    .expect("root children array")[0];
  let attrs = text_node["attributesArray"]
    .as_array()
    .expect("text attributesArray");
  let text_attrs: Vec<_> = attrs.iter().filter(|attr| attr["key"] == "text").collect();
  assert_eq!(
    text_attrs.len(),
    1,
    "explicit text attr should not be duplicated by child-text optimization"
  );
  assert_eq!(text_attrs[0]["value"], "Explicit Text Attribute");

  let children = text_node["children"]
    .as_array()
    .expect("text children array");
  assert_eq!(
    children.len(),
    1,
    "child text should stay as a child when text attr is already explicit"
  );
  assert_eq!(children[0]["type"], "raw-text");
}

#[test]
fn should_preserve_text_children_when_text_attr_may_come_from_spread() {
  let template = first_user_template_json(
    r#"
      <view>
        <text {...props}>Child Text</text>
      </view>
    "#,
  );

  let text_node = &template["children"]
    .as_array()
    .expect("root children array")[0];
  let attrs = text_node["attributesArray"]
    .as_array()
    .expect("text attributesArray");
  assert!(
    attrs.iter().any(|attr| attr["kind"] == "spread"),
    "text spread descriptor should be preserved"
  );
  assert!(
    attrs.iter().all(|attr| attr["key"] != "text"),
    "static child-text optimization must not add a text attr after a spread"
  );

  let children = text_node["children"]
    .as_array()
    .expect("text children array");
  assert_eq!(
    children.len(),
    1,
    "child text should stay as a child when spread could provide text"
  );
  assert_eq!(children[0]["type"], "raw-text");
}

#[test]
fn should_not_inject_root_entry_name_attr_for_dynamic_component_element_template() {
  let (code, template) = first_user_template_json_with_code(
    r#"
      /**
       * @jsxCSSId 100
       */
      <view id={dynamicId}>
        <text>Hello</text>
      </view>
    "#,
    dynamic_component_element_template_config(),
  );
  assert!(
    !code.contains("entryName") && !code.contains("options={{"),
    "dynamic component ET lowering should not emit legacy entry metadata, got: {code}"
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
fn should_keep_static_attribute_values_out_of_et_attribute_slots() {
  let (code, template) = first_user_template_json_with_code(
    r#"
      <view disabled title="hello
        lynx" id={1} data-count={2} data-overflow={1e400} class={cls} />
    "#,
    element_template_config(),
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  let attr_by_key = |key: &str| {
    attrs
      .iter()
      .find(|attr| attr["key"] == key)
      .unwrap_or_else(|| panic!("missing attribute descriptor for {key}: {attrs:?}"))
  };

  assert_eq!(attr_by_key("disabled")["binding"], "static");
  assert_eq!(attr_by_key("disabled")["value"].as_bool(), Some(true));
  assert_eq!(attr_by_key("id")["binding"], "static");
  assert_eq!(attr_by_key("id")["value"].as_f64(), Some(1.0));
  assert_eq!(attr_by_key("data-count")["binding"], "static");
  assert_eq!(attr_by_key("data-count")["value"].as_f64(), Some(2.0));
  assert_eq!(attr_by_key("data-overflow")["binding"], "slot");
  assert_eq!(
    attr_by_key("data-overflow")["attrSlotIndex"].as_f64(),
    Some(0.0)
  );
  assert_eq!(attr_by_key("class")["binding"], "slot");
  assert_eq!(attr_by_key("class")["attrSlotIndex"].as_f64(), Some(1.0));
  let code = without_whitespace(&code);
  assert!(
    code.contains("attributeSlots={[1e400,cls]}"),
    "overflowed numeric literals should stay observable via ET attribute slots, got: {code}"
  );
}

#[test]
fn should_not_consume_hidden_et_slots_for_list_item_platform_attrs() {
  let (code, template) = first_user_template_json_with_code(
    r#"
      <list-item item-key={itemKey} recyclable>
        <text>Hello</text>
      </list-item>
    "#,
    element_template_config(),
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  let item_key = attrs
    .iter()
    .find(|attr| attr["key"] == "item-key")
    .expect("item-key descriptor");
  let recyclable = attrs
    .iter()
    .find(|attr| attr["key"] == "recyclable")
    .expect("recyclable descriptor");

  assert_eq!(item_key["binding"], "slot");
  assert_eq!(item_key["attrSlotIndex"].as_f64(), Some(0.0));
  assert_eq!(recyclable["binding"], "static");
  assert_eq!(recyclable["value"].as_bool(), Some(true));
  let code = without_whitespace(&code);
  assert!(
    code.contains("attributeSlots={[itemKey]}"),
    "legacy list platform info must not consume ET attribute slots, got: {code}"
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
fn should_keep_worklet_attr_descriptor_keys_for_namespaced_attrs() {
  let template = first_user_template_json(
    r#"
      <view main-thread:bindtap={handleTap} main-thread:ref={viewRef} />
    "#,
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  assert_eq!(attrs.len(), 2);

  assert_eq!(attrs[0]["kind"], "attribute");
  assert_eq!(attrs[0]["key"], "main-thread:bindtap");
  assert_eq!(attrs[0]["binding"], "slot");
  assert_eq!(attrs[0]["attrSlotIndex"].as_f64(), Some(0.0));

  assert_eq!(attrs[1]["kind"], "attribute");
  assert_eq!(attrs[1]["key"], "main-thread:ref");
  assert_eq!(attrs[1]["binding"], "slot");
  assert_eq!(attrs[1]["attrSlotIndex"].as_f64(), Some(1.0));
}

#[test]
fn should_treat_unknown_namespaced_attrs_as_regular_attrs() {
  let template = first_user_template_json(
    r#"
      <view custom:flag={flag} custom:static={1} />
    "#,
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  assert_eq!(attrs.len(), 2);

  assert_eq!(attrs[0]["kind"], "attribute");
  assert_eq!(attrs[0]["key"], "custom:flag");
  assert_eq!(attrs[0]["binding"], "slot");
  assert_eq!(attrs[0]["attrSlotIndex"].as_f64(), Some(0.0));

  assert_eq!(attrs[1]["kind"], "attribute");
  assert_eq!(attrs[1]["key"], "custom:static");
  assert_eq!(attrs[1]["binding"], "static");
  assert_eq!(attrs[1]["value"].as_f64(), Some(1.0));
}

#[test]
fn should_skip_lynx_part_id_without_reserving_attr_slot() {
  let template = first_user_template_json(
    r#"
      <view __lynx_part_id={partId} id={dynamicId} />
    "#,
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  assert_eq!(attrs.len(), 1);

  assert_eq!(attrs[0]["kind"], "attribute");
  assert_eq!(attrs[0]["key"], "id");
  assert_eq!(attrs[0]["binding"], "slot");
  assert_eq!(attrs[0]["attrSlotIndex"].as_f64(), Some(0.0));
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
  assert_eq!(children[0]["type"], "text");
  assert_eq!(children[1]["kind"], "elementSlot");
  assert_eq!(children[1]["elementSlotIndex"].as_f64(), Some(0.0));
  assert_eq!(children[1]["type"], "slot");
  assert_eq!(children[2]["kind"], "element");
  assert_eq!(children[2]["type"], "image");
  assert_eq!(children[3]["kind"], "elementSlot");
  assert_eq!(children[3]["elementSlotIndex"].as_f64(), Some(1.0));
  assert_eq!(children[3]["type"], "slot");
}

#[test]
fn should_extract_dynamic_key_child_as_element_slot() {
  let templates = transform_to_templates(
    r#"
      <view>
        <text key={item.id}>Child Text</text>
      </view>
    "#,
    element_template_config(),
  );
  let template = templates
    .into_iter()
    .map(|template| {
      serde_json::to_value(template.compiled_template).expect("compiled template to json")
    })
    .find(|template| template["type"] == "view")
    .expect("root view template");

  let children = template["children"].as_array().expect("children array");
  assert_eq!(children.len(), 1);
  assert_eq!(children[0]["kind"], "elementSlot");
  assert_eq!(children[0]["elementSlotIndex"].as_f64(), Some(0.0));
  assert_eq!(children[0]["type"], "slot");
}

#[test]
fn should_preserve_user_wrapper_elements_as_template_nodes() {
  let template = first_user_template_json(
    r#"
      <view>
        <wrapper id="user-wrapper">
          <text>content</text>
        </wrapper>
        {dynamicChild}
      </view>
    "#,
  );

  let children = template["children"].as_array().expect("children array");
  assert_eq!(children[0]["kind"], "element");
  assert_eq!(children[0]["type"], "wrapper");

  let wrapper_attrs = children[0]["attributesArray"]
    .as_array()
    .expect("wrapper attributesArray");
  assert_eq!(wrapper_attrs[0]["key"], "id");
  assert_eq!(wrapper_attrs[0]["binding"], "static");
  assert_eq!(wrapper_attrs[0]["value"], "user-wrapper");

  assert_eq!(children[1]["kind"], "elementSlot");
  assert_eq!(children[1]["elementSlotIndex"].as_f64(), Some(0.0));
}
