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

const BUILTIN_RAW_TEXT_TEMPLATE_ID: &str = "_et_builtin_raw_text";

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

fn assert_single_framework_css_id_attr(template: &Value, expected_css_id: f64, message: &str) {
  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  let css_id_attrs = attrs
    .iter()
    .filter(|attr| attr["key"] == "css-id")
    .collect::<Vec<_>>();
  assert_eq!(css_id_attrs.len(), 1, "{message}");
  assert_eq!(css_id_attrs[0]["kind"], "static");
  assert_eq!(css_id_attrs[0]["value"].as_f64(), Some(expected_css_id));
  assert!(
    attrs.iter().all(|attr| attr["key"] != "entry-name"),
    "{message}: element should not carry entry-name attrs",
  );
}

fn assert_no_css_scope_attrs(template: &Value, message: &str) {
  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  assert!(
    attrs
      .iter()
      .all(|attr| attr["key"] != "css-id" && attr["key"] != "entry-name"),
    "{message}",
  );
}

fn assert_attr_plan_assignment(code: &str, expected_entries: &str, message: &str) {
  let marker = "ReactLynxInternal.__etAttrPlanMap[_et_";
  let start = code
    .find(marker)
    .unwrap_or_else(|| panic!("{message}, got: {code}"));
  let assignment = &code[start..];
  let end = assignment
    .find(';')
    .unwrap_or_else(|| panic!("{message}, got: {code}"));
  let assignment = &assignment[..=end];
  let hash_end = assignment[marker.len()..]
    .find(']')
    .unwrap_or_else(|| panic!("{message}, got: {code}"));
  let hash = &assignment[marker.len()..marker.len() + hash_end];

  assert_eq!(hash.len(), 12, "{message}, got: {code}");
  assert!(
    hash
      .chars()
      .all(|ch| ch.is_ascii_hexdigit() && !ch.is_ascii_uppercase()),
    "{message}, got: {code}"
  );
  assert!(
    assignment.ends_with(&format!("]=[{expected_entries}];")),
    "{message}, got: {code}"
  );
}

#[test]
fn should_emit_direct_event_attr_plan_for_js_target() {
  let (code, _) = first_user_template_json_with_code(
    r#"
      <view bindtap={handleTap} catchtouchstart={handleTouch} />
    "#,
    JSXTransformerConfig {
      target: swc_plugins_shared::target::TransformTarget::JS,
      ..element_template_config()
    },
  );
  let code = without_whitespace(&code);

  assert_attr_plan_assignment(
    &code,
    "0,ReactLynxInternal.adaptEventAttrSlot,1,ReactLynxInternal.adaptEventAttrSlot",
    "direct event slots should register a sparse ET attr plan",
  );
  assert!(
    code.contains("attributeSlots={[handleTap,handleTouch]}"),
    "JS target should keep raw handlers in attributeSlots before runtime preparation, got: {code}"
  );
  assert!(
    !code.contains("__etEventSlots"),
    "event slot metadata must not be passed through Preact props, got: {code}"
  );
}

#[test]
fn should_emit_direct_event_attr_plan_for_lepus_target() {
  let (code, _) = first_user_template_json_with_code(
    r#"
      <view bindtap={handleTap} catchtouchstart={handleTouch} />
    "#,
    JSXTransformerConfig {
      target: swc_plugins_shared::target::TransformTarget::LEPUS,
      ..element_template_config()
    },
  );
  let code = without_whitespace(&code);

  assert_attr_plan_assignment(
    &code,
    "0,ReactLynxInternal.adaptEventAttrSlot,1,ReactLynxInternal.adaptEventAttrSlot",
    "direct event slots should register a sparse ET attr plan",
  );
  assert!(
    code.contains("attributeSlots={[1,1]}"),
    "LEPUS target should keep event markers in attributeSlots before runtime preparation, got: {code}"
  );
}

#[test]
fn should_emit_spread_attr_plan_with_ref_adapter() {
  let (code, _) = first_user_template_json_with_code(
    r#"
      <view id={dynamicId} ref={viewRef} {...props} />
    "#,
    JSXTransformerConfig {
      target: swc_plugins_shared::target::TransformTarget::JS,
      ..element_template_config()
    },
  );
  let code = without_whitespace(&code);

  assert_attr_plan_assignment(
    &code,
    "1,ReactLynxInternal.adaptRefAttrSlot,2,ReactLynxInternal.adaptSpreadAttrSlot",
    "ref and spread slots should register ET attr adapters",
  );
  assert!(
    !code.contains("adaptEventAttrSlot"),
    "ref, spread, and ordinary attrs must not enter the event adapter plan, got: {code}"
  );
}

#[test]
fn should_inject_css_scope_attr_for_element_template_subtree() {
  let (code, template) = first_user_template_json_with_code(
    r#"
      /**
       * @jsxCSSId 100
       */
      <view className="task-login-card">
        <text className="task-login-card-btn">Hello</text>
        <text text="Explicit Text Attribute">Child Text</text>
      </view>
    "#,
    element_template_config(),
  );
  assert!(
    !code.contains("options={{") && !code.contains("cssId"),
    "element template lowering should not emit legacy cssId create metadata, got: {code}"
  );

  assert_single_framework_css_id_attr(
    &template,
    100.0,
    "root element should carry framework css-id attr",
  );

  let children = template["children"].as_array().expect("children array");
  assert_single_framework_css_id_attr(
    &children[0],
    100.0,
    "nested text element should carry framework css-id attr",
  );
  assert_single_framework_css_id_attr(
    &children[1],
    100.0,
    "nested text element with explicit text attr should carry framework css-id attr",
  );

  let raw_text = &children[1]["children"]
    .as_array()
    .expect("explicit text child array")[0];
  assert_eq!(raw_text["type"], "raw-text");
  assert_single_framework_css_id_attr(
    raw_text,
    100.0,
    "inline raw-text child should carry framework css-id attr",
  );
}

#[test]
fn should_inject_css_scope_attr_for_each_user_template_root() {
  let templates = transform_to_templates(
    r#"
      /**
       * @jsxCSSId 100
       */
      const first = <view />;
      const second = <image />;
    "#,
    element_template_config(),
  );

  let user_templates = templates
    .into_iter()
    .filter(|template| template.template_id != BUILTIN_RAW_TEXT_TEMPLATE_ID)
    .map(|template| {
      serde_json::to_value(template.compiled_template).expect("compiled template to json")
    })
    .collect::<Vec<_>>();
  assert_eq!(
    user_templates.len(),
    2,
    "should collect both user template roots"
  );

  for template in user_templates {
    let attrs = template["attributesArray"]
      .as_array()
      .expect("attributesArray");
    assert!(
      attrs.iter().any(|attr| {
        attr["key"] == "css-id" && attr["kind"] == "static" && attr["value"].as_f64() == Some(100.0)
      }),
      "user template root should carry framework css-id attr: {template:?}",
    );
  }
}

#[test]
fn should_not_inject_css_scope_attrs_without_jsx_css_id() {
  let template = first_user_template_json(
    r#"
      <view>
        <text>Hello</text>
      </view>
    "#,
  );

  assert_no_css_scope_attrs(
    &template,
    "root element should not carry css scope attrs without @jsxCSSId",
  );
  let child = &template["children"].as_array().expect("children array")[0];
  assert_no_css_scope_attrs(
    child,
    "nested static elements should not carry css scope attrs without @jsxCSSId",
  );
}

#[test]
fn should_append_framework_css_id_after_spread_attrs() {
  let template = first_user_template_json(
    r#"
      /**
       * @jsxCSSId 100
       */
      <view {...props}>
        <text {...childProps} />
      </view>
    "#,
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  assert_eq!(attrs[0]["kind"], "spread");
  let last_attr = attrs.last().expect("root should have attrs");
  assert_eq!(last_attr["key"], "css-id");
  assert_eq!(last_attr["kind"], "static");
  assert_eq!(last_attr["value"].as_f64(), Some(100.0));

  let child = &template["children"].as_array().expect("children array")[0];
  let child_attrs = child["attributesArray"]
    .as_array()
    .expect("child attributesArray");
  assert_eq!(child_attrs[0]["kind"], "spread");
  let child_last_attr = child_attrs.last().expect("child should have attrs");
  assert_eq!(child_last_attr["key"], "css-id");
  assert_eq!(child_last_attr["kind"], "static");
  assert_eq!(child_last_attr["value"].as_f64(), Some(100.0));
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
fn should_inject_css_id_without_entry_name_attr_for_dynamic_component_element_template() {
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
    attrs.iter().any(|attr| {
      attr["key"] == "css-id" && attr["kind"] == "static" && attr["value"].as_f64() == Some(100.0)
    }),
    "dynamic component root should carry framework css-id attr",
  );
  assert!(
    attrs.iter().all(|attr| attr["key"] != "entry-name"),
    "dynamic component root should not encode entry metadata in attrs",
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

  assert_eq!(attr_by_key("disabled")["kind"], "static");
  assert_eq!(attr_by_key("disabled")["value"].as_bool(), Some(true));
  assert_eq!(attr_by_key("id")["kind"], "static");
  assert_eq!(attr_by_key("id")["value"].as_f64(), Some(1.0));
  assert_eq!(attr_by_key("data-count")["kind"], "static");
  assert_eq!(attr_by_key("data-count")["value"].as_f64(), Some(2.0));
  assert_eq!(attr_by_key("data-overflow")["kind"], "slot");
  assert_eq!(
    attr_by_key("data-overflow")["attrSlotIndex"].as_f64(),
    Some(0.0)
  );
  assert_eq!(attr_by_key("class")["kind"], "slot");
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

  assert_eq!(item_key["kind"], "slot");
  assert_eq!(item_key["attrSlotIndex"].as_f64(), Some(0.0));
  assert_eq!(recyclable["kind"], "static");
  assert_eq!(recyclable["value"].as_bool(), Some(true));
  let code = without_whitespace(&code);
  assert!(
    code.contains("attributeSlots={[itemKey]}"),
    "legacy list platform info must not consume ET attribute slots, got: {code}"
  );
  assert!(
    code.contains("__listItemPlatformInfo={{\"item-key\":itemKey,\"recyclable\":true}}"),
    "list item platform info should be available as an ET runtime-only carrier, got: {code}"
  );
}

#[test]
fn should_lower_exact_list_as_typed_runtime_host() {
  let (templates, code) = transform_fixture(
    r#"
      <list id={listId} className="feed">
        <list-item key="a" item-key={firstKey} full-span />
        <list-item key="b" item-key={secondKey} recyclable />
      </list>
    "#,
    element_template_config(),
  );

  let user_templates: Vec<_> = templates
    .into_iter()
    .filter(|template| template.template_id != BUILTIN_RAW_TEXT_TEMPLATE_ID)
    .map(|template| serde_json::to_value(template.compiled_template).expect("compiled template"))
    .collect();

  assert!(
    user_templates
      .iter()
      .all(|template| template["type"] != "list"),
    "exact list must stay as a typed runtime host instead of a compiled template: {user_templates:?}"
  );
  assert!(
    user_templates
      .iter()
      .any(|template| template["type"] == "list-item"),
    "non-defer list items should remain ordinary compiled ET roots: {user_templates:?}"
  );

  let code = without_whitespace(&code);
  assert!(
    code.contains("<listattributes={{\"id\":listId,\"class\":\"feed\"}}$0={["),
    "ET list output should expose exact list, attributes, and $0 logical children, got: {code}"
  );
  assert!(
    code.contains("__listItemPlatformInfo={{\"item-key\":firstKey,\"full-span\":true}}")
      && code.contains("__listItemPlatformInfo={{\"item-key\":secondKey,\"recyclable\":true}}"),
    "list item roots should carry platform info beside compiled ET roots, got: {code}"
  );
}

#[test]
fn should_keep_slot_descriptor_order_for_dynamic_attr_spread_event_and_ref() {
  let (code, template) = first_user_template_json_with_code(
    r#"
      <view id={dynamicId} {...props} bindtap={handleTap} ref={viewRef} />
    "#,
    element_template_config(),
  );
  let code = without_whitespace(&code);
  assert_attr_plan_assignment(
    &code,
    "1,ReactLynxInternal.adaptSpreadAttrSlot,2,ReactLynxInternal.adaptEventAttrSlot,3,ReactLynxInternal.adaptRefAttrSlot",
    "spread, direct event, and ref adapters should keep their descriptor slot order",
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  assert_eq!(attrs.len(), 4);

  assert_eq!(attrs[0]["kind"], "slot");
  assert_eq!(attrs[0]["key"], "id");
  assert_eq!(attrs[0]["attrSlotIndex"].as_f64(), Some(0.0));

  assert_eq!(attrs[1]["kind"], "spread");
  assert_eq!(attrs[1]["attrSlotIndex"].as_f64(), Some(1.0));

  assert_eq!(attrs[2]["kind"], "slot");
  assert_eq!(attrs[2]["key"], "bindtap");
  assert_eq!(attrs[2]["attrSlotIndex"].as_f64(), Some(2.0));

  assert_eq!(attrs[3]["kind"], "slot");
  assert_eq!(attrs[3]["key"], "ref");
  assert_eq!(attrs[3]["attrSlotIndex"].as_f64(), Some(3.0));
}

#[test]
fn should_convert_direct_camel_case_attributes() {
  let (code, template) = first_user_template_json_with_code(
    r#"
      <text
        textMaxline={2}
        tailColorConvert={enabled}
        bindTap={handleTap}
        onReady="ready"
        {...props}
      />
    "#,
    JSXTransformerConfig {
      enable_camel_case_attributes: true,
      ..element_template_config()
    },
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  let keys = attrs
    .iter()
    .filter_map(|attr| attr["key"].as_str())
    .collect::<Vec<_>>();
  assert!(
    keys.contains(&"text-maxline"),
    "missing text-maxline: {attrs:?}"
  );
  assert!(
    keys.contains(&"tail-color-convert"),
    "missing tail-color-convert: {attrs:?}"
  );
  assert!(keys.contains(&"bindTap"), "event name changed: {attrs:?}");
  assert!(
    keys.contains(&"onReady"),
    "React event name changed: {attrs:?}"
  );
  assert!(
    without_whitespace(&code).contains("adaptSpreadAttrSlot") && code.contains("props"),
    "ET spread values should remain on the common spread path, got: {code}"
  );
}

#[test]
fn should_keep_worklet_attr_descriptor_keys_for_namespaced_attrs() {
  let (code, template) = first_user_template_json_with_code(
    r#"
      <view main-thread:bindtap={handleTap} main-thread:ref={viewRef} />
    "#,
    element_template_config(),
  );
  let code = without_whitespace(&code);
  assert!(
    code.contains("adaptMTEventAttrSlot"),
    "main-thread event must use the ET MTEvent adapter, got: {code}"
  );
  assert!(
    !code.contains("adaptEventAttrSlot"),
    "main-thread event must not use the ordinary ET event adapter, got: {code}"
  );
  assert!(
    !code.contains("adaptRefAttrSlot"),
    "main-thread:ref must not be lowered as an ordinary ET ref adapter, got: {code}"
  );
  assert!(
    !code.contains("viewRef"),
    "unsupported namespaced ref must not leak the raw ref value, got: {code}"
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  assert_eq!(attrs.len(), 2);

  assert_eq!(attrs[0]["kind"], "slot");
  assert_eq!(attrs[0]["key"], "main-thread:bindtap");
  assert_eq!(attrs[0]["attrSlotIndex"].as_f64(), Some(0.0));

  assert_eq!(attrs[1]["kind"], "slot");
  assert_eq!(attrs[1]["key"], "main-thread:ref");
  assert_eq!(attrs[1]["attrSlotIndex"].as_f64(), Some(1.0));
}

#[test]
fn should_not_emit_mt_event_adapter_for_non_event_main_thread_attrs() {
  let (code, template) = first_user_template_json_with_code(
    r#"
      <view main-thread:id={getId} />
    "#,
    element_template_config(),
  );
  let code = without_whitespace(&code);
  assert!(
    !code.contains("adaptMTEventAttrSlot"),
    "non-event main-thread attrs are future-track scoped and must not use the MTEvent adapter, got: {code}"
  );
  assert!(
    !code.contains("adaptEventAttrSlot"),
    "non-event main-thread attrs must not use the ordinary event adapter, got: {code}"
  );
  assert!(
    !code.contains("adaptRefAttrSlot"),
    "non-event main-thread attrs must not use the ordinary ref adapter, got: {code}"
  );

  let attrs = template["attributesArray"]
    .as_array()
    .expect("attributesArray");
  assert_eq!(attrs.len(), 1);

  assert_eq!(attrs[0]["kind"], "slot");
  assert_eq!(attrs[0]["key"], "main-thread:id");
  assert_eq!(attrs[0]["attrSlotIndex"].as_f64(), Some(0.0));
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

  assert_eq!(attrs[0]["kind"], "slot");
  assert_eq!(attrs[0]["key"], "custom:flag");
  assert_eq!(attrs[0]["attrSlotIndex"].as_f64(), Some(0.0));

  assert_eq!(attrs[1]["kind"], "static");
  assert_eq!(attrs[1]["key"], "custom:static");
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

  assert_eq!(attrs[0]["kind"], "slot");
  assert_eq!(attrs[0]["key"], "id");
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
  assert_eq!(wrapper_attrs[0]["kind"], "static");
  assert_eq!(wrapper_attrs[0]["value"], "user-wrapper");

  assert_eq!(children[1]["kind"], "elementSlot");
  assert_eq!(children[1]["elementSlotIndex"].as_f64(), Some(0.0));
}
