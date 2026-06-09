use swc_core::ecma::parser::{EsSyntax, Syntax};
use swc_plugin_element_template::{ElementTemplateAsset, JSXTransformer, JSXTransformerConfig};
use swc_plugins_shared::target::TransformTarget;
use swc_plugins_shared::transform_mode::TransformMode;

const BUILTIN_RAW_TEXT_TEMPLATE_ID: &str = "_et_builtin_raw_text";
const CONTENT_ADDRESSED_TEMPLATE_ID_LEN: usize = "_et_".len() + 12;

fn user_templates(templates: &[ElementTemplateAsset]) -> Vec<&ElementTemplateAsset> {
  templates
    .iter()
    .filter(|template| template.template_id != BUILTIN_RAW_TEXT_TEMPLATE_ID)
    .collect()
}

fn assert_content_addressed_template_id(template_id: &str) {
  let hash = template_id
    .strip_prefix("_et_")
    .unwrap_or_else(|| panic!("expected ET template id prefix, got {template_id}"));
  assert_eq!(
    template_id.len(),
    CONTENT_ADDRESSED_TEMPLATE_ID_LEN,
    "expected _et_<12hex> template id, got {template_id}"
  );
  assert!(
    hash
      .chars()
      .all(|ch| ch.is_ascii_hexdigit() && !ch.is_ascii_uppercase()),
    "expected lowercase hex content-addressed template id, got {template_id}"
  );
}

fn assert_has_single_builtin_raw_text_template(templates: &[ElementTemplateAsset]) {
  let builtin_count = templates
    .iter()
    .filter(|template| template.template_id == BUILTIN_RAW_TEXT_TEMPLATE_ID)
    .count();
  assert_eq!(
    builtin_count, 1,
    "Expected exactly one builtin raw-text template, got {}",
    builtin_count
  );
}

fn assert_single_framework_css_id_attr(
  template: &serde_json::Value,
  expected_css_id: f64,
  message: &str,
) {
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
}

fn template_snapshot_json(templates: &[ElementTemplateAsset]) -> Vec<serde_json::Value> {
  templates
    .iter()
    .map(|t| {
      serde_json::json!({
          "template_id": t.template_id,
          "template": t.compiled_template
      })
    })
    .collect()
}

fn max_attr_slot_index(value: &serde_json::Value) -> Option<usize> {
  match value {
    serde_json::Value::Object(map) => {
      let own_slot = map
        .get("attrSlotIndex")
        .and_then(|slot| slot.as_u64())
        .map(|slot| slot as usize);
      map
        .values()
        .filter_map(max_attr_slot_index)
        .chain(own_slot)
        .max()
    }
    serde_json::Value::Array(values) => values.iter().filter_map(max_attr_slot_index).max(),
    _ => None,
  }
}

fn first_attribute_slots_len(code: &str) -> Option<usize> {
  let prefix = "attributeSlots={[";
  let start = code.find(prefix)? + prefix.len();
  let mut square_depth = 0usize;
  let mut brace_depth = 0usize;
  let mut paren_depth = 0usize;
  let mut quote: Option<char> = None;
  let mut escape = false;
  let mut has_content = false;
  let mut len = 1usize;

  for ch in code[start..].chars() {
    if let Some(quote_ch) = quote {
      if escape {
        escape = false;
        continue;
      }
      if ch == '\\' {
        escape = true;
        continue;
      }
      if ch == quote_ch {
        quote = None;
      }
      continue;
    }

    match ch {
      '\'' | '"' | '`' => {
        has_content = true;
        quote = Some(ch);
      }
      '[' => {
        has_content = true;
        square_depth += 1;
      }
      ']' if square_depth == 0 && brace_depth == 0 && paren_depth == 0 => {
        return Some(if has_content { len } else { 0 });
      }
      ']' => {
        if square_depth == 0 {
          return None;
        }
        square_depth -= 1;
      }
      '{' => {
        has_content = true;
        brace_depth += 1;
      }
      '}' => {
        if brace_depth == 0 {
          return None;
        }
        brace_depth -= 1;
      }
      '(' => {
        has_content = true;
        paren_depth += 1;
      }
      ')' => {
        if paren_depth == 0 {
          return None;
        }
        paren_depth -= 1;
      }
      ',' if square_depth == 0 && brace_depth == 0 && paren_depth == 0 => len += 1,
      ch if !ch.is_whitespace() => has_content = true,
      _ => {}
    }
  }

  None
}

fn assert_attribute_slots_match_template(code: &str, templates: &[ElementTemplateAsset]) {
  let expected = templates
    .iter()
    .filter(|template| template.template_id != BUILTIN_RAW_TEXT_TEMPLATE_ID)
    .filter_map(|template| max_attr_slot_index(&template.compiled_template))
    .max()
    .map(|slot| slot + 1);

  let Some(expected) = expected else {
    return;
  };

  let actual = first_attribute_slots_len(code).expect("ET output should include attributeSlots");
  assert_eq!(
    actual, expected,
    "Template Definition attrSlotIndex expects {expected} attribute slot values, but transformed JSX emitted {actual}.\n{code}"
  );
}

macro_rules! et_snapshot_test {
  ($name:ident, $input:expr) => {
    #[test]
    fn $name() {
      verify_code_and_template_json($input, stringify!($name));
    }
  };
  ($name:ident, $cfg:expr, $input:expr) => {
    #[test]
    fn $name() {
      verify_code_and_template_json_with_config($input, stringify!($name), $cfg);
    }
  };
}

et_snapshot_test!(
  should_output_element_template_simple_lepus,
  element_template_config_for_target(TransformTarget::LEPUS),
  r#"
    <view class="container">
      <text>Hello</text>
    </view>
    "#
);

et_snapshot_test!(
  should_output_template_with_static_attributes,
  r#"
    <view class="container" id="main" style="color: red;">
        <text>Hello</text>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_dataset_attributes,
  r#"
    <view data-id="123" data-name="test" data-long-name="long-value">
        <text>Dataset Test</text>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_nested_structure_and_dynamic_content,
  r#"
    <view class="wrapper">
        <view class="header">
            <text>Header</text>
        </view>
        <view class="content">
            {/* Expression should become an elementSlot */}
            {items.map(item => <text>{item}</text>)}
        </view>
        <view class="footer">
            <text>Footer</text>
            {/* Another slot */}
            {showCopyright && <text>Copyright</text>}
        </view>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_mixed_content,
  r#"
    <view>
        <text>Start</text>
        {dynamicPart}
        <view>Middle</view>
        <text>End</text>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_boolean_and_number_attributes,
  r#"
    <view disabled={true} opacity={0.5} lines={2}>
        <text>Attribute Types Test</text>
    </view>
    "#
);

et_snapshot_test!(
  should_generate_attribute_slots_for_dynamic_attributes,
  r#"
    <view class="static" id={dynamicId}>
        <text data-value={value}>Dynamic Value</text>
        <view>Static</view>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_complex_text_structure,
  r#"
    <view>
        <text>
            Hello
            <text>World</text>
            !
        </text>
        <text>
             First
             <text>Second</text>
             Third
        </text>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_spread_attributes,
  r#"
    <view {...props} data-extra="value">
        <text>Spread Test</text>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_events_lepus,
  element_template_config_for_target(TransformTarget::LEPUS),
  r#"
    <view bindtap={handleTap} catchtouchstart={handleTouch}>
        <text>Event Test</text>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_events_js,
  element_template_config_for_target(TransformTarget::JS),
  r#"
    <view bindtap={handleTap} catchtouchstart={handleTouch}>
        <text>Event Test</text>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_inline_styles,
  r#"
    <view style="color: red; width: 100px;">
        <text style={{ fontSize: '16px', fontWeight: 'bold' }}>Static Style</text>
        <view style={{ color: dynamicColor }}>Dynamic Style</view>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_refs_lepus,
  element_template_config_for_target(TransformTarget::LEPUS),
  r#"
    <view ref={viewRef}>
        <text>Ref Test</text>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_refs_js,
  element_template_config_for_target(TransformTarget::JS),
  r#"
    <view ref={viewRef}>
        <text>Ref Test</text>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_dynamic_class_attributes,
  r#"
    <view class={dynamicClass} className="static-class">
        <text>Dynamic Class Test</text>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_id_attributes,
  r#"
    <view id="static-id">
        <text id={dynamicId}>ID Test</text>
    </view>
    "#
);

et_snapshot_test!(
  should_isolate_arrays_with_element_slot_placeholder,
  r#"
    <view>
        {["a", "b"]}
        <text>Static</text>
        {["c", "d"]}
    </view>
    "#
);

et_snapshot_test!(
  should_handle_user_component,
  r#"
    <view>
      <Component id={1}>
        <text>hello</text>
      </Component>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_interpolated_text_with_siblings_lepus,
  element_template_config_for_target(TransformTarget::LEPUS),
  r#"
    <view>
      <view id='1'>
        {items}
      </view>
       <view id='2'>
          {items.map((item) => <text>{item}</text>)}
       </view>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_interpolated_text_with_siblings_js,
  element_template_config_for_target(TransformTarget::JS),
  r#"
    <view>
      <view id='1'>
        {items}
      </view>
       <view id='2'>
          {items.map((item) => <text>{item}</text>)}
       </view>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_sibling_user_components,
  r#"
    <view>
      <Component>
        <text>Slot Content 1</text>
      </Component>
      <Component>
        <text>Slot Content 2</text>
      </Component>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_deeply_nested_user_components,
  r#"
    <view>
      <Outer title={title}>
        <Middle enabled={enabled}>
          <Inner count={count}>
            <text>Deep Slot</text>
          </Inner>
        </Middle>
      </Outer>
    </view>
    "#
);

et_snapshot_test!(
  should_handle_background_conditional_attributes,
  r#"
      function App() {
        const attrs = __BACKGROUND__
          ? {
            0: { id: 'b' },
            2: { data: 'extra' },
          }
          : {
            0: { id: 'a' },
            1: { title: 'main' },
          };
        return (
          <view data-a={attrs} b={attrs} />
        );
      }
    "#
);

et_snapshot_test!(
  should_verify_template_structure_complex,
  r#"
    <view class="container" id={dynamicId}>
        <text>Static</text>
        <image src={url} />
    </view>
    "#
);

et_snapshot_test!(
  should_verify_text_attribute_and_child_text_slots,
  r#"
    <view>
        <text text="Explicit Text Attribute" />
        <text text={dynamicText} />
        <text>{dynamicText2}</text>
    </view>
    "#
);

et_snapshot_test!(
  should_keep_code_and_template_attribute_slots_in_sync_for_spread,
  r#"
      <view id={dynamicId} {...props} bindtap={handleTap} ref={viewRef}>
        <text>Spread Sync</text>
      </view>
    "#
);

#[track_caller]
fn transform_to_code_and_templates(
  input: &str,
  cfg: JSXTransformerConfig,
) -> (String, Vec<ElementTemplateAsset>) {
  let (code, templates, _) = transform_to_code_templates_and_diagnostics(input, cfg);
  (code, templates)
}

#[track_caller]
fn transform_to_code_templates_and_diagnostics(
  input: &str,
  cfg: JSXTransformerConfig,
) -> (String, Vec<ElementTemplateAsset>, Vec<String>) {
  transform_to_code_templates_and_diagnostics_with_mode(input, cfg, TransformMode::Test)
}

#[track_caller]
fn transform_to_code_templates_and_diagnostics_with_mode(
  input: &str,
  cfg: JSXTransformerConfig,
  mode: TransformMode,
) -> (String, Vec<ElementTemplateAsset>, Vec<String>) {
  use std::cell::RefCell;
  use std::rc::Rc;
  use std::sync::{Arc, Mutex};
  use swc_core::common::{
    comments::SingleThreadedComments,
    errors::{DiagnosticBuilder, Emitter as DiagnosticEmitter, Handler, HANDLER},
    FileName, Globals, SourceMap, GLOBALS,
  };
  use swc_core::ecma::codegen::{text_writer::JsWriter, Emitter};
  use swc_core::ecma::parser::{lexer::Lexer, Parser, StringInput};
  use swc_core::ecma::visit::VisitMutWith;

  struct DiagnosticCollector {
    messages: Arc<Mutex<Vec<String>>>,
  }

  impl DiagnosticEmitter for DiagnosticCollector {
    fn emit(&mut self, db: &mut DiagnosticBuilder<'_>) {
      self.messages.lock().unwrap().push(db.message().to_string());
    }
  }

  GLOBALS.set(&Globals::new(), || {
    let cm: Arc<SourceMap> = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(FileName::Anon.into(), input.to_string());
    let diagnostics = Arc::new(Mutex::new(vec![]));
    let handler = Handler::with_emitter(
      true,
      false,
      Box::new(DiagnosticCollector {
        messages: diagnostics.clone(),
      }),
    );

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
    let module_result = parser.parse_module();
    let mut module = module_result.expect("Failed to parse module");

    let element_templates = Rc::new(RefCell::new(vec![]));

    let mut transformer = JSXTransformer::new_with_element_templates(
      cfg,
      Some(comments),
      mode,
      None,
      Some(element_templates.clone()),
    );

    HANDLER.set(&handler, || {
      module.visit_mut_with(&mut transformer);
    });

    let mut buf = vec![];
    {
      let mut emitter = Emitter {
        cfg: swc_core::ecma::codegen::Config::default(),
        cm: cm.clone(),
        comments: None,
        wr: JsWriter::new(cm.clone(), "\n", &mut buf, None),
      };
      emitter.emit_module(&module).expect("Failed to emit module");
    }

    let code = String::from_utf8(buf).expect("Codegen output is not valid utf8");
    let templates: Vec<_> = element_templates.borrow_mut().drain(..).collect();
    let diagnostics = diagnostics.lock().unwrap().clone();

    (code, templates, diagnostics)
  })
}

#[track_caller]
fn verify_code_and_template_json(
  input: &str,
  snapshot_name: &str,
) -> (String, Vec<ElementTemplateAsset>) {
  verify_code_and_template_json_with_config(input, snapshot_name, element_template_config())
}

fn element_template_config() -> JSXTransformerConfig {
  JSXTransformerConfig {
    preserve_jsx: true,
    ..Default::default()
  }
}

fn element_template_config_for_target(target: TransformTarget) -> JSXTransformerConfig {
  JSXTransformerConfig {
    target,
    ..element_template_config()
  }
}

fn dynamic_component_element_template_config() -> JSXTransformerConfig {
  JSXTransformerConfig {
    is_dynamic_component: Some(true),
    ..element_template_config()
  }
}

#[track_caller]
fn verify_code_and_template_json_with_config(
  input: &str,
  snapshot_name: &str,
  cfg: JSXTransformerConfig,
) -> (String, Vec<ElementTemplateAsset>) {
  let (code, templates) = transform_to_code_and_templates(input, cfg);

  assert!(!templates.is_empty(), "Should collect element templates");
  assert_attribute_slots_match_template(&code, &templates);

  insta::with_settings!({
      snapshot_path => "__combined_snapshots__",
      prepend_module_to_snapshot => false,
  }, {
      insta::assert_json_snapshot!(snapshot_name, serde_json::json!({
        "code": code,
        "templates": template_snapshot_json(&templates),
      }));
  });

  (code, templates)
}

#[test]
fn should_not_emit_element_template_map_in_element_template_mode() {
  let (code, templates) = transform_to_code_and_templates(
    r#"
      <view class="container">
        <text>Hello</text>
      </view>
    "#,
    element_template_config(),
  );

  assert_has_single_builtin_raw_text_template(&templates);
  assert!(!code.contains("__elementTemplateMap"));
  assert!(!code.contains("__template_"));
  assert!(code.contains("const _et_"));
  assert!(!code.contains("const __snapshot_"));

  for template in templates {
    assert!(template.template_id.starts_with("_et_"));
    if template.template_id != BUILTIN_RAW_TEXT_TEMPLATE_ID {
      assert!(code.contains(&format!("\"{}\"", template.template_id)));
    }
  }
}

#[test]
fn should_not_use_snapshot_ref_transform_in_element_template_mode() {
  let (code, _, _) = transform_to_code_templates_and_diagnostics_with_mode(
    r#"<view ref={viewRef} />"#,
    JSXTransformerConfig {
      runtime_pkg: "@custom/react".into(),
      target: TransformTarget::JS,
      ..element_template_config()
    },
    TransformMode::Development,
  );

  assert!(code.contains(r#"require("@custom/react/internal").adaptRefAttrSlot"#));
  assert!(code.contains("viewRef"));
  assert!(!code.contains("transformRef"));
  assert!(!code.contains("@lynx-js/react/internal"));
}

#[test]
fn should_collect_element_templates_for_dynamic_component_in_element_template_mode() {
  let (code, templates) = transform_to_code_and_templates(
    r#"
      <view class="container">
        <text>Hello</text>
      </view>
    "#,
    dynamic_component_element_template_config(),
  );

  assert!(!templates.is_empty(), "Should collect element templates");
  assert_has_single_builtin_raw_text_template(&templates);
  assert!(!code.contains("__elementTemplateMap"));
  assert!(code.contains("globDynamicComponentEntry"));
  assert!(!code.contains("templateKey"));
  assert!(!code.contains("bundleUrl"));

  for template in templates {
    assert!(template.template_id.starts_with("_et_"));
    assert!(!template.template_id.contains(':'));
  }
}

#[test]
fn should_reuse_same_content_template_id_and_asset_in_one_module() {
  let (code, templates) = transform_to_code_and_templates(
    r#"
      const first = (
        <view class="card">
          <text>Hello</text>
        </view>
      );
      const second = (
        <view class="card">
          <text>Hello</text>
        </view>
      );
    "#,
    element_template_config(),
  );

  let user_templates = user_templates(&templates);
  assert_eq!(
    user_templates.len(),
    1,
    "same compiled Template Definition should emit one user asset: {templates:#?}"
  );
  let template_id = &user_templates[0].template_id;
  assert_content_addressed_template_id(template_id);
  assert_eq!(
    code.matches(&format!("const {template_id} =")).count(),
    1,
    "same content should emit one template id const:\n{code}"
  );
  assert_eq!(
    code.matches(&format!("<{template_id}")).count(),
    2,
    "both JSX usages should reference the reused template id exactly once each:\n{code}"
  );
}

#[test]
fn should_keep_different_compiled_templates_on_distinct_ids() {
  let (_, templates) = transform_to_code_and_templates(
    r#"
      const first = <view class="primary" />;
      const second = <view class="secondary" />;
    "#,
    element_template_config(),
  );

  let user_templates = user_templates(&templates);
  assert_eq!(user_templates.len(), 2, "{templates:#?}");
  assert_ne!(
    user_templates[0].template_id, user_templates[1].template_id,
    "different compiled Template Definitions must not share one id"
  );
  for template in user_templates {
    assert_content_addressed_template_id(&template.template_id);
  }
}

#[test]
fn should_emit_one_attr_plan_for_interned_event_ref_and_spread_template() {
  let (code, templates) = transform_to_code_and_templates(
    r#"
      const first = <view bindtap={onTap} ref={firstRef} {...firstProps} />;
      const second = <view bindtap={onPress} ref={secondRef} {...secondProps} />;
    "#,
    element_template_config_for_target(TransformTarget::JS),
  );

  let user_templates = user_templates(&templates);
  assert_eq!(
    user_templates.len(),
    1,
    "same event/ref/spread Template Definition should intern to one asset: {templates:#?}"
  );
  assert_content_addressed_template_id(&user_templates[0].template_id);
  assert_eq!(
    code.matches("__etAttrPlanMap[").count(),
    1,
    "interned template should emit one attr-plan assignment:\n{code}"
  );
  assert!(code.contains("adaptEventAttrSlot"), "{code}");
  assert!(code.contains("adaptRefAttrSlot"), "{code}");
  assert!(code.contains("adaptSpreadAttrSlot"), "{code}");
  assert_attribute_slots_match_template(&code, &templates);
}

#[test]
fn should_keep_dynamic_component_asset_id_content_addressed_without_entry_prefix() {
  let (code, templates) = transform_to_code_and_templates(
    r#"
      <view class="container">
        <text>Hello</text>
      </view>
    "#,
    dynamic_component_element_template_config(),
  );

  assert!(code.contains("globDynamicComponentEntry"), "{code}");
  for template in user_templates(&templates) {
    assert_content_addressed_template_id(&template.template_id);
    assert!(
      !template.template_id.contains(':'),
      "asset id must not include dynamic entry prefix: {}",
      template.template_id
    );
  }
}

#[test]
fn should_report_page_element_as_unsupported() {
  let (_, templates, diagnostics) = transform_to_code_templates_and_diagnostics(
    r#"
      <page>
        <view>Page Element Test</view>
      </page>
    "#,
    element_template_config(),
  );

  assert!(
    diagnostics
      .iter()
      .any(|message| message == "<page /> is not supported"),
    "expected <page /> unsupported diagnostic, got: {diagnostics:?}"
  );
  assert!(
    templates.is_empty(),
    "unsupported <page /> should not emit poisoned templates: {templates:?}"
  );
}

#[test]
fn should_report_invalid_jsx_css_id_as_diagnostic() {
  let (_, _, diagnostics) = transform_to_code_templates_and_diagnostics(
    r#"
      /**
       * @jsxCSSId abc
       */
      <view>Invalid Css Id</view>
    "#,
    element_template_config(),
  );

  assert!(
    diagnostics
      .iter()
      .any(|message| message == "@jsxCSSId must be numeric, got `abc`"),
    "expected invalid @jsxCSSId diagnostic, got: {diagnostics:?}"
  );
}

#[test]
fn should_warn_and_override_direct_user_css_id_attr() {
  let (_, templates, diagnostics) = transform_to_code_templates_and_diagnostics(
    r#"
      /**
       * @jsxCSSId 100
       */
      <view css-id="user-css-id" />
    "#,
    element_template_config(),
  );

  assert!(
    diagnostics
      .iter()
      .any(|message| { message.contains("css-id") && message.contains("overridden") }),
    "expected direct css-id override diagnostic, got: {diagnostics:?}"
  );

  let template = templates
    .iter()
    .find(|template| template.template_id != BUILTIN_RAW_TEXT_TEMPLATE_ID)
    .expect("should collect a user template");
  let template = serde_json::to_value(&template.compiled_template).expect("compiled template json");
  assert_single_framework_css_id_attr(
    &template,
    100.0,
    "direct user css-id should be replaced by the framework css-id",
  );
}

#[test]
fn should_warn_and_override_dynamic_user_css_id_attr_without_reserving_slot() {
  let (code, templates, diagnostics) = transform_to_code_templates_and_diagnostics(
    r#"
      /**
       * @jsxCSSId 100
       */
      <view css-id={userCssId} />
    "#,
    element_template_config(),
  );

  assert!(
    diagnostics
      .iter()
      .any(|message| { message.contains("css-id") && message.contains("overridden") }),
    "expected direct css-id override diagnostic, got: {diagnostics:?}"
  );
  assert!(
    !code.contains("attributeSlots"),
    "overridden dynamic css-id should not reserve an ET attribute slot, got: {code}"
  );

  let template = templates
    .iter()
    .find(|template| template.template_id != BUILTIN_RAW_TEXT_TEMPLATE_ID)
    .expect("should collect a user template");
  let template = serde_json::to_value(&template.compiled_template).expect("compiled template json");
  assert_single_framework_css_id_attr(
    &template,
    100.0,
    "dynamic user css-id should be replaced by the framework css-id",
  );
}
