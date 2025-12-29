use wasm_bindgen::prelude::*;

pub mod transformer;

#[wasm_bindgen]
pub fn transform_raw_u16_inline_style_ptr(str: &str) -> Option<String> {
  let (transformed_inline_style, _) = transformer::transform::transform_inline_style_string(str);
  if !transformed_inline_style.is_empty() {
    Some(transformed_inline_style)
  } else {
    None
  }
}

#[wasm_bindgen]
pub fn transform_raw_u16_inline_style_ptr_parsed(name: &str, value: &str) -> Option<js_sys::Array> {
  let (result, children_result) = transformer::transform::query_transform_rules(name, value);
  if result.is_empty() && children_result.is_empty() {
    // if there are no results, we return None
    return None;
  }
  // now we need to convert the result into a JS array
  let ret = js_sys::Array::new();
  let current_result_js_arr = js_sys::Array::new();
  for (key, value) in result {
    // we need to push the key and value as a string
    let pair = js_sys::Array::new();
    pair.push(&JsValue::from_str(key));
    pair.push(&JsValue::from_str(value));
    current_result_js_arr.push(&pair.into());
  }
  ret.push(&current_result_js_arr.into());
  if !children_result.is_empty() {
    // if there are no children, we don't need to push an empty array
    // but if there are children, we need to push them as well
    let children_result_js_arr = js_sys::Array::new();
    for (key, value) in children_result {
      // we need to push the key and value as a string
      let pair = js_sys::Array::new();
      pair.push(&JsValue::from_str(key));
      pair.push(&JsValue::from_str(value));
      children_result_js_arr.push(&pair.into());
    }
    ret.push(&children_result_js_arr.into());
  }
  Some(ret)
}
