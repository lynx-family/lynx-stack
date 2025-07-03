use wasm_bindgen::prelude::*;

pub mod parser;
pub mod transformer;

// lifted from the `console_log` example
/**
accept a raw uint16 ptr from JS
*/
#[wasm_bindgen]
pub fn transform_raw_u16_inline_style_ptr(ptr: *const u16, len: usize) -> Option<js_sys::JsString> {
  // Safety: We assume the pointer is valid and points to a slice of u16
  // of length `len`. This is a contract with the JavaScript side.
  unsafe {
    let slice = core::slice::from_raw_parts(ptr, len);
    // Call the tokenize function with our data and callback
    let (transformed_inline_style, _) =
      transformer::transformer::transform_inline_style_string(&slice);
    if !transformed_inline_style.is_empty() {
      return Some(js_sys::JsString::from_char_code(
        &transformed_inline_style.as_slice(),
      ));
    }
  }
  None
}
macro_rules! push_parsed_result_to_js_array {
  ($source:expr) => {{
    let target = js_sys::Array::new();
    for transformed in $source {
      let (name_source, name_start, name_end, value_source, value_start, value_end) = transformed;
      let k = js_sys::JsString::from_char_code(name_source.get(name_start..name_end).unwrap());
      let v = js_sys::JsString::from_char_code(value_source.get(value_start..value_end).unwrap());
      let pair = js_sys::Array::new();
      pair.push(&k);
      pair.push(&v);
      target.push(&pair);
    }
    target
  }};
}
#[wasm_bindgen]
pub fn transform_raw_u16_inline_style_ptr_parsed(
  name_ptr: *const u16,
  name_len: usize,
  value_ptr: *const u16,
  value_len: usize,
) -> js_sys::Array {
  unsafe {
    let name_slice = core::slice::from_raw_parts(name_ptr, name_len);
    let value_slice = core::slice::from_raw_parts(value_ptr, value_len);
    // Call the tokenize function with our data and callback
    let (result, children_result) = transformer::transformer::query_transform_rules(
      name_slice,
      0,
      name_len,
      value_slice,
      0,
      value_len,
    );
    // now we need to convert the result into a JS array
    let ret = js_sys::Array::new();
    ret.push(&push_parsed_result_to_js_array!(result).into());
    if !children_result.is_empty() {
      // if there are no children, we don't need to push an empty array
      // but if there are children, we need to push them as well
      ret.push(&push_parsed_result_to_js_array!(children_result).into());
    }
    ret
  }
}

#[wasm_bindgen]
pub fn malloc(size: usize) -> *mut u8 {
  // Allocate memory on the heap
  let layout = std::alloc::Layout::from_size_align(size, 8).unwrap();
  unsafe { std::alloc::alloc(layout) }
}

#[wasm_bindgen]
pub fn free(ptr: *mut u8, size: usize) {
  // Free the allocated memory
  // We need to reconstruct the Layout that was used for allocation.
  // Assuming align is 1 as used in malloc.
  let layout = std::alloc::Layout::from_size_align(size, 8).unwrap();
  unsafe { std::alloc::dealloc(ptr, layout) }
}
