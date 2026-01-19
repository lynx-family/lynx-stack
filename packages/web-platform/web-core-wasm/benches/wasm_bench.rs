#![cfg(all(feature = "client", feature = "encode", target_arch = "wasm32"))]

use wasm_bindgen_test::{wasm_bindgen_bench, wasm_bindgen_test_configure, Criterion};

use web_core_wasm::css_tokenizer::tokenize::{self, Parser};
use web_core_wasm::{
  ElementTemplateSection, Generator, RawElementTemplate, RawStyleInfo, Rule, RulePrelude, Selector,
  StyleInfoDecoder, StyleTransformer,
};

wasm_bindgen_test_configure!(run_in_node_experimental);

#[derive(Default)]
struct TokenCounter {
  token_count: usize,
  byte_count: usize,
}

impl Parser for TokenCounter {
  fn on_token(&mut self, _token_type: u8, value: &str) {
    self.token_count += 1;
    self.byte_count += value.len();
  }
}

#[derive(Default)]
struct CountingGenerator {
  transformed_count: usize,
  kids_count: usize,
  byte_count: usize,
}

impl Generator for CountingGenerator {
  fn push_transformed_style(&mut self, value: String) {
    self.transformed_count += 1;
    self.byte_count += value.len();
  }

  fn push_transform_kids_style(&mut self, value: String) {
    self.kids_count += 1;
    self.byte_count += value.len();
  }
}

fn tokenize_css(input: &str) -> (usize, usize) {
  let mut counter = TokenCounter::default();
  tokenize::tokenize(input, &mut counter);
  (counter.token_count, counter.byte_count)
}

fn transform_css(input: &str) -> (usize, usize, usize) {
  let mut generator = CountingGenerator::default();
  let mut transformer = StyleTransformer::new(&mut generator);
  transformer.parse(input);
  (
    generator.transformed_count,
    generator.kids_count,
    generator.byte_count,
  )
}

#[cfg(feature = "encode")]
fn build_style_info_bytes() -> js_sys::Uint8Array {
  let mut raw = build_sample_style_info();
  raw
    .encode()
    .expect("RawStyleInfo encode should succeed in benchmarks")
}

#[cfg(feature = "encode")]
fn build_element_template_bytes() -> js_sys::Uint8Array {
  let mut section = ElementTemplateSection::new();
  for index in 0..6 {
    let mut template = RawElementTemplate::new();
    let root_id = 1;
    template.create_element("view".to_string(), root_id);
    template.set_attribute(root_id, "class".to_string(), format!("root-{index}"));
    template.set_dataset(root_id, "idx".to_string(), index.to_string());
    template.set_cross_thread_event(
      root_id,
      "tap".to_string(),
      format!("rootTap{index}"),
      "true".to_string(),
    );

    let mut child_id = 2;
    for child_index in 0..8 {
      template.create_element("text".to_string(), child_id);
      template.set_attribute(
        child_id,
        "data-child".to_string(),
        format!("{index}-{child_index}"),
      );
      template.append_child(root_id, child_id);
      child_id += 1;
    }
    template.append_to_root(root_id);
    section.add_element_template(format!("template-{index}"), template);
  }
  section.encode()
}

#[cfg(feature = "encode")]
fn decode_element_template_bytes(bytes: &js_sys::Uint8Array) -> usize {
  let section = ElementTemplateSection::try_from(bytes.clone())
    .expect("ElementTemplateSection decode should succeed in benchmarks");
  section.element_templates_map.len()
}

#[cfg(feature = "encode")]
fn build_sample_style_info() -> RawStyleInfo {
  let mut raw = RawStyleInfo::new();
  raw.append_import(1, 2);

  let mut rule = Rule::new("StyleRule".to_string()).expect("rule should build");
  let mut selector = Selector::new();
  selector
    .push_one_selector_section("ClassSelector".to_string(), "card".to_string())
    .expect("selector section should build");
  selector
    .push_one_selector_section("Combinator".to_string(), ">".to_string())
    .expect("selector section should build");
  selector
    .push_one_selector_section("TypeSelector".to_string(), "view".to_string())
    .expect("selector section should build");
  let mut prelude = RulePrelude::new();
  prelude.push_selector(selector);
  rule.set_prelude(prelude);
  rule.push_declaration("width".to_string(), "100rpx".to_string());
  rule.push_declaration("height".to_string(), "200rpx".to_string());
  rule.push_declaration("display".to_string(), "flex".to_string());
  raw.push_rule(1, rule);

  let mut font_face = Rule::new("FontFaceRule".to_string()).expect("rule should build");
  font_face.push_declaration("font-family".to_string(), "BenchFont".to_string());
  font_face.push_declaration("src".to_string(), "url(bench.woff)".to_string());
  raw.push_rule(1, font_face);

  let mut keyframes = Rule::new("KeyframesRule".to_string()).expect("rule should build");
  let mut keyframes_prelude = RulePrelude::new();
  let mut keyframes_selector = Selector::new();
  keyframes_selector
    .push_one_selector_section("UnknownText".to_string(), "fade".to_string())
    .expect("selector section should build");
  keyframes_prelude.push_selector(keyframes_selector);
  keyframes.set_prelude(keyframes_prelude);

  let mut from_rule = Rule::new("StyleRule".to_string()).expect("rule should build");
  let mut from_prelude = RulePrelude::new();
  let mut from_selector = Selector::new();
  from_selector
    .push_one_selector_section("UnknownText".to_string(), "from".to_string())
    .expect("selector section should build");
  from_prelude.push_selector(from_selector);
  from_rule.set_prelude(from_prelude);
  from_rule.push_declaration("opacity".to_string(), "0".to_string());
  keyframes.push_rule_children(from_rule);

  let mut to_rule = Rule::new("StyleRule".to_string()).expect("rule should build");
  let mut to_prelude = RulePrelude::new();
  let mut to_selector = Selector::new();
  to_selector
    .push_one_selector_section("UnknownText".to_string(), "to".to_string())
    .expect("selector section should build");
  to_prelude.push_selector(to_selector);
  to_rule.set_prelude(to_prelude);
  to_rule.push_declaration("opacity".to_string(), "1".to_string());
  keyframes.push_rule_children(to_rule);
  raw.push_rule(1, keyframes);

  raw
}
#[cfg(feature = "encode")]
fn decode_style_info_bytes(bytes: &js_sys::Uint8Array) {
  let mut buf = vec![0u8; bytes.length() as usize];
  bytes.copy_to(&mut buf);
  let (raw, _): (RawStyleInfo, usize) =
    bincode::decode_from_slice(&buf, bincode::config::standard())
      .expect("RawStyleInfo decode should succeed");
  let _ = StyleInfoDecoder::new(raw, None, true).expect("StyleInfoDecoder should succeed");
}

const CSS_SMALL: &str = r#"
.card {
  width: 100rpx;
  height: 200rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 16rpx;
  border-radius: 8rpx;
  background: linear-gradient(90deg, #111, #333);
}
"#;

const CSS_LARGE: &str = r#"
.container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  padding: 24rpx;
  gap: 12rpx;
  background: #0c0c0c;
  }
  .card {
    width: 720rpx;
    height: 320rpx;
    padding: 24rpx 32rpx;
    border-radius: 24rpx;
    background: linear-gradient(135deg, #202020, #3a3a3a);
    box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.35);
  }
  .card .title {
    font-size: 32rpx;
    font-weight: 600;
    color: #fff;
  }
  .card .subtitle {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.7);
  }
  .list > .item + .item {
    margin-top: 12rpx;
  }
  .button[disabled] {
    opacity: 0.5;
  }
  "#;

#[wasm_bindgen_bench]
fn bench_tokenize_small(c: &mut Criterion) {
  c.bench_function("tokenize_small", |b| {
    b.iter(|| tokenize_css(CSS_SMALL));
  });
}

#[wasm_bindgen_bench]
fn bench_tokenize_large(c: &mut Criterion) {
  c.bench_function("tokenize_large", |b| {
    b.iter(|| tokenize_css(CSS_LARGE));
  });
}

#[wasm_bindgen_bench]
fn bench_transform_small(c: &mut Criterion) {
  c.bench_function("transform_small", |b| {
    b.iter(|| transform_css(CSS_SMALL));
  });
}

#[wasm_bindgen_bench]
fn bench_transform_large(c: &mut Criterion) {
  c.bench_function("transform_large", |b| {
    b.iter(|| transform_css(CSS_LARGE));
  });
}

#[cfg(feature = "encode")]
#[wasm_bindgen_bench]
fn bench_style_info_encode(c: &mut Criterion) {
  c.bench_function("style_info_encode", |b| {
    b.iter(|| build_style_info_bytes());
  });
}

#[cfg(feature = "encode")]
#[wasm_bindgen_bench]
fn bench_element_template_encode(c: &mut Criterion) {
  c.bench_function("element_template_encode", |b| {
    b.iter(|| build_element_template_bytes());
  });
}

#[cfg(feature = "encode")]
#[wasm_bindgen_bench]
fn bench_element_template_decode(c: &mut Criterion) {
  let bytes = build_element_template_bytes();
  c.bench_function("element_template_decode", |b| {
    b.iter(|| decode_element_template_bytes(&bytes));
  });
}

const CSS_COMPLEX: &str = r#"
  /* A large CSS file simulating a complex component library */
  :root {
    --primary: #007bff;
    --secondary: #6c757d;
    --success: #28a745;
    --info: #17a2b8;
    --warning: #ffc107;
    --danger: #dc3545;
    --light: #f8f9fa;
    --dark: #343a40;
  }
  
  .btn {
    display: inline-block;
    font-weight: 400;
    color: #212529;
    text-align: center;
    vertical-align: middle;
    user-select: none;
    background-color: transparent;
    border: 1rpx solid transparent;
    padding: 0.375rem 0.75rem;
    font-size: 1rem;
    line-height: 1.5;
    border-radius: 0.25rem;
    transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  }
  
  .btn-primary {
    color: #fff;
    background-color: #007bff;
    border-color: #007bff;
  }
  
  .btn-primary:hover {
    color: #fff;
    background-color: #0069d9;
    border-color: #0062cc;
  }
  
  .card-header {
    padding: 0.75rem 1.25rem;
    margin-bottom: 0;
    background-color: rgba(0, 0, 0, 0.03);
    border-bottom: 1rpx solid rgba(0, 0, 0, 0.125);
  }
  
  @media (min-width: 576px) {
    .container {
      max-width: 540px;
    }
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .spinner {
    animation: spin 1s linear infinite;
  }
  
  /* Repeated content to make it larger */
  .item-1 { width: 100%; height: 50px; background: red; }
  .item-2 { width: 100%; height: 50px; background: blue; }
  .item-3 { width: 100%; height: 50px; background: green; }
  .item-4 { width: 100%; height: 50px; background: yellow; }
  .item-5 { width: 100%; height: 50px; background: purple; }
  .item-6 { width: 100%; height: 50px; background: orange; }
  .item-7 { width: 100%; height: 50px; background: pink; }
  .item-8 { width: 100%; height: 50px; background: brown; }
  .item-9 { width: 100%; height: 50px; background: gray; }
  .item-10 { width: 100%; height: 50px; background: black; }
  "#;

#[wasm_bindgen_bench]
fn bench_tokenize_complex(c: &mut Criterion) {
  c.bench_function("tokenize_complex", |b| {
    b.iter(|| tokenize_css(CSS_COMPLEX));
  });
}

#[wasm_bindgen_bench]
fn bench_transform_complex(c: &mut Criterion) {
  c.bench_function("transform_complex", |b| {
    b.iter(|| transform_css(CSS_COMPLEX));
  });
}

#[cfg(feature = "encode")]
#[wasm_bindgen_bench]
fn bench_style_info_decode(c: &mut Criterion) {
  let bytes = build_style_info_bytes();
  c.bench_function("style_info_decode", |b| {
    b.iter(|| decode_style_info_bytes(&bytes));
  });
}
