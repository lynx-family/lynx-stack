use swc_core::ecma::transforms::testing::test;
use swc_core::ecma::{
  parser::{EsSyntax, Syntax},
  visit::visit_mut_pass,
};
use swc_plugin_snapshot::{JSXTransformer, JSXTransformerConfig};
use swc_plugins_shared::target::TransformTarget;
use swc_plugins_shared::transform_mode::TransformMode;

const BUILTIN_RAW_TEXT_TEMPLATE_ID: &str = "__et_builtin_raw_text__";

fn assert_has_single_builtin_raw_text_template(
  templates: &[swc_plugin_snapshot::ElementTemplateAsset],
) {
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

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      target: TransformTarget::LEPUS,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_output_element_template_simple_lepus,
  // Input codes
  r#"
    <view class="container">
      <text>Hello</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      target: TransformTarget::JS,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_output_element_template_simple_js,
  // Input codes
  r#"
    <view class="container">
      <text>Hello</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_output_template_with_static_attributes,
  // Input codes
  r#"
    <view class="container" id="main" style="color: red;">
        <text>Hello</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: false,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_not_output_template_when_flag_is_false,
  // Input codes
  r#"
    <view>
        <text>Normal Snapshot</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_dataset_attributes,
  // Input codes
  r#"
    <view data-id="123" data-name="test" data-long-name="long-value">
        <text>Dataset Test</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_nested_structure_and_dynamic_content,
  // Input codes
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

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_ignore_dynamic_attributes,
  // Input codes
  r#"
    <view class="container" id={dynamicId} style={{color: 'red'}}>
        <text>Dynamic Attribute Test</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_mixed_content,
  // Input codes
  r#"
    <view>
        <text>Start</text>
        {dynamicPart}
        <view>Middle</view>
        <text>End</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_boolean_and_number_attributes,
  // Input codes
  r#"
    <view disabled={true} opacity={0.5} lines={2}>
        <text>Attribute Types Test</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_generate_attribute_slots_for_dynamic_attributes,
  // Input codes
  r#"
    <view class="static" id={dynamicId}>
        <text data-value={value}>Dynamic Value</text>
        <view>Static</view>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_complex_text_structure,
  // Input codes
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

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_spread_attributes,
  // Input codes
  r#"
    <view {...props} data-extra="value">
        <text>Spread Test</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      target: TransformTarget::LEPUS,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_events_lepus,
  // Input codes
  r#"
    <view bindtap={handleTap} catchtouchstart={handleTouch}>
        <text>Event Test</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      target: TransformTarget::JS,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_events_js,
  // Input codes
  r#"
    <view bindtap={handleTap} catchtouchstart={handleTouch}>
        <text>Event Test</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_inline_styles,
  // Input codes
  r#"
    <view style="color: red; width: 100px;">
        <text style={{ fontSize: '16px', fontWeight: 'bold' }}>Static Style</text>
        <view style={{ color: dynamicColor }}>Dynamic Style</view>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      target: TransformTarget::LEPUS,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_refs_lepus,
  // Input codes
  r#"
    <view ref={viewRef}>
        <text>Ref Test</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      target: TransformTarget::JS,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_refs_js,
  // Input codes
  r#"
    <view ref={viewRef}>
        <text>Ref Test</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_css_id,
  // Input codes
  r#"
/**
 * @jsxCSSId 100
 */
    <view class="container">
        <text>CSS ID Test</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_page_element,
  // Input codes
  r#"
    <page>
        <view>Page Element Test</view>
    </page>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_text_attributes,
  // Input codes
  r#"
    <view>
        <text text="Explicit Text Attribute" />
        <text text={dynamicText} />
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_dynamic_class_attributes,
  // Input codes
  r#"
    <view class={dynamicClass} className="static-class">
        <text>Dynamic Class Test</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_id_attributes,
  // Input codes
  r#"
    <view id="static-id">
        <text id={dynamicId}>ID Test</text>
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_isolate_arrays_with_slot_wrapper,
  // Input codes
  r#"
    <view>
        {["a", "b"]}
        <text>Static</text>
        {["c", "d"]}
    </view>
    "#
);

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_user_component,
  // Input codes
  r#"
    <view>
      <Component id={1}>
        <text>hello</text>
      </Component>
    </view>
    "#
);

test!(
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_interpolated_text_with_siblings,
  // Input codes mimicking multiple-text fixture
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

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_sibling_user_components,
  // Input codes
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

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_handle_background_conditional_attributes,
  // Input codes
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

#[track_caller]
fn verify_template_json(input: &str, snapshot_name: &str) {
  use std::cell::RefCell;
  use std::rc::Rc;
  use swc_core::common::{comments::SingleThreadedComments, FileName, Globals, SourceMap, GLOBALS};
  use swc_core::ecma::parser::{lexer::Lexer, Parser, StringInput};
  use swc_core::ecma::visit::VisitMutWith;

  // Adapt UPDATE=1 to INSTA_UPDATE=always for backward compatibility/convenience
  if std::env::var("UPDATE").as_deref() == Ok("1") {
    std::env::set_var("INSTA_UPDATE", "always");
  }

  GLOBALS.set(&Globals::new(), || {
    let cm = Rc::new(SourceMap::default());
    let fm = cm.new_source_file(FileName::Anon.into(), input.to_string());

    let lexer = Lexer::new(
      Syntax::Es(EsSyntax {
        jsx: true,
        ..Default::default()
      }),
      Default::default(),
      StringInput::from(&*fm),
      None,
    );

    let mut parser = Parser::new_from(lexer);
    let module_result = parser.parse_module();
    let mut module = module_result.expect("Failed to parse module");

    let comments = SingleThreadedComments::default();
    let element_templates = Rc::new(RefCell::new(vec![]));

    let mut transformer = JSXTransformer::new_with_element_templates(
      JSXTransformerConfig {
        preserve_jsx: true,
        experimental_enable_element_template: true,
        ..Default::default()
      },
      Some(comments),
      TransformMode::Test,
      None,
      Some(element_templates.clone()),
    );

    module.visit_mut_with(&mut transformer);

    let templates = element_templates.borrow();
    assert!(!templates.is_empty(), "Should collect element templates");

    // Collect all compiled templates for snapshot, including template_id
    let actual_jsons: Vec<_> = templates
      .iter()
      .map(|t| {
        serde_json::json!({
            "template_id": t.template_id,
            "template": t.compiled_template
        })
      })
      .collect();

    insta::with_settings!({
        snapshot_path => "__json_snapshots__",
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_json_snapshot!(snapshot_name, actual_jsons);
    });
  });
}

#[test]
fn should_verify_template_structure_complex() {
  verify_template_json(
    r#"
    <view class="container" id={dynamicId}>
        <text>Static</text>
        <image src={url} />
    </view>
    "#,
    "complex_usage",
  );
  verify_template_json(
    r#"
    <view>
        <text text="Explicit Text Attribute" />
        <text text={dynamicText} />
        <text>{dynamicText2}</text>
    </view>
    "#,
    "text_attributes",
  );
  verify_template_json(
    r#"
      <view>
        <Component id={1}>
          <text>hello</text>
        </Component>
      </view>
    "#,
    "user_component",
  );
  verify_template_json(
    r#"
    <view>
        {["a", "b"]}
        <text>Static</text>
        {["c", "d"]}
    </view>
    "#,
    "array_isolation",
  );
}

#[track_caller]
fn transform_to_code_and_templates(
  input: &str,
  cfg: JSXTransformerConfig,
) -> (String, Vec<swc_plugin_snapshot::ElementTemplateAsset>) {
  use std::cell::RefCell;
  use std::rc::Rc;
  use std::sync::Arc;
  use swc_core::common::{comments::SingleThreadedComments, FileName, Globals, SourceMap, GLOBALS};
  use swc_core::ecma::codegen::{text_writer::JsWriter, Emitter};
  use swc_core::ecma::parser::{lexer::Lexer, Parser, StringInput};
  use swc_core::ecma::visit::VisitMutWith;

  GLOBALS.set(&Globals::new(), || {
    let cm: Arc<SourceMap> = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(FileName::Anon.into(), input.to_string());

    let lexer = Lexer::new(
      Syntax::Es(EsSyntax {
        jsx: true,
        ..Default::default()
      }),
      Default::default(),
      StringInput::from(&*fm),
      None,
    );

    let mut parser = Parser::new_from(lexer);
    let module_result = parser.parse_module();
    let mut module = module_result.expect("Failed to parse module");

    let comments = SingleThreadedComments::default();
    let element_templates = Rc::new(RefCell::new(vec![]));

    let mut transformer = JSXTransformer::new_with_element_templates(
      cfg,
      Some(comments),
      TransformMode::Test,
      None,
      Some(element_templates.clone()),
    );

    module.visit_mut_with(&mut transformer);

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

    (code, templates)
  })
}

#[test]
fn should_not_emit_element_template_map_in_element_template_mode() {
  let (code, templates) = transform_to_code_and_templates(
    r#"
      <view class="container">
        <text>Hello</text>
      </view>
    "#,
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      ..Default::default()
    },
  );

  assert!(!templates.is_empty(), "Should collect element templates");
  assert_has_single_builtin_raw_text_template(&templates);
  assert!(!code.contains("__elementTemplateMap"));
  assert!(!code.contains("__template_"));
  assert!(code.contains("const _et_"));
  assert!(!code.contains("const __snapshot_"));

  for template in templates {
    if template.template_id == BUILTIN_RAW_TEXT_TEMPLATE_ID {
      continue;
    }
    assert!(template.template_id.starts_with("_et_"));
    assert!(code.contains(&format!("\"{}\"", template.template_id)));
  }
}

#[test]
fn should_keep_snapshot_prefix_when_element_template_disabled() {
  let (code, templates) = transform_to_code_and_templates(
    r#"
      <view>
        <text>Hello</text>
      </view>
    "#,
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: false,
      ..Default::default()
    },
  );

  assert!(templates.is_empty(), "Should not collect element templates");
  assert!(code.contains("const __snapshot_"));
  assert!(code.contains("snapshotCreatorMap"));
  assert!(!code.contains("const _et_"));
}

#[test]
fn should_collect_element_templates_for_dynamic_component_in_element_template_mode() {
  let (code, templates) = transform_to_code_and_templates(
    r#"
      <view class="container">
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

  assert!(!templates.is_empty(), "Should collect element templates");
  assert_has_single_builtin_raw_text_template(&templates);
  assert!(!code.contains("__elementTemplateMap"));
  assert!(code.contains("globDynamicComponentEntry"));

  for template in templates {
    assert!(
      template.template_id == BUILTIN_RAW_TEXT_TEMPLATE_ID
        || template.template_id.starts_with("_et_")
    );
    assert!(!template.template_id.contains(':'));
  }
}

test!(
  module,
  Syntax::Es(EsSyntax {
    jsx: true,
    ..Default::default()
  }),
  |t| visit_mut_pass(JSXTransformer::new(
    JSXTransformerConfig {
      preserve_jsx: true,
      experimental_enable_element_template: true,
      is_dynamic_component: Some(true),
      ..Default::default()
    },
    Some(t.comments.clone()),
    TransformMode::Test,
    None,
  )),
  should_append_entry_name_to_attribute_slots_for_dynamic_component_in_element_template_mode,
  // Input codes
  r#"
/**
 * @jsxCSSId 100
 */
  <view id={dynamicId}>
    <text>Hello</text>
  </view>
  "#
);
