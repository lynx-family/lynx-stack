use wasm_bindgen::prelude::*;

pub mod css;
pub mod transformer;
// lifted from the `console_log` example
/**
accept a raw uint16 ptr from JS
*/
#[wasm_bindgen]
pub fn transform_raw_u16_inline_style_ptr(ptr: *const u16, len: usize) {
  // Safety: We assume the pointer is valid and points to a slice of u16
  // of length `len`. This is a contract with the JavaScript side.
  unsafe {
    let slice = core::slice::from_raw_parts(ptr, len);
    // Call the tokenize function with our data and callback
    let (transformed_inline_style, _) =
      transformer::transformer::transform_inline_style_string(&slice);
    if !transformed_inline_style.is_empty() {
      let ptr = transformed_inline_style.as_ptr();
      on_transformed(ptr, transformed_inline_style.len());
    }
  }
}

#[wasm_bindgen]
pub fn transform_raw_u16_inline_style_ptr_parsed(
  source_ptr: *const u16,
  source_len: usize,
  declaration_position_arr_ptr: *const usize,
  declaration_position_arr_len: usize,
) {
  // Safety: We assume the pointer is valid and points to a slice of u16
  // of length `source_len` and `declaration_position_arr_len`.
  unsafe {
    let source_slice = core::slice::from_raw_parts(source_ptr, source_len);
    let declaration_position_arr_slice =
      core::slice::from_raw_parts(declaration_position_arr_ptr, declaration_position_arr_len);
    let (transformed_inline_style, transformed_children_styles) =
      transformer::transformer::transform_parsed_style_string(
        source_slice,
        declaration_position_arr_slice,
      );

    if !transformed_inline_style.is_empty() {
      let ptr = transformed_inline_style.as_ptr();
      on_transformed(ptr, transformed_inline_style.len());
    }
    if !transformed_children_styles.is_empty() {
      let ptr = transformed_children_styles.as_ptr();
      on_extra_children_style(ptr, transformed_children_styles.len());
    }
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

#[wasm_bindgen(
  inline_js = "export function on_transformed(ptr, len) { globalThis._on_transformed_callback(ptr, len); }"
)]
extern "C" {
  fn on_transformed(ptr: *const u16, len: usize);
}
#[wasm_bindgen(
  inline_js = "export function on_extra_children_style(ptr, len) { globalThis._on_extra_children_style_callback(ptr, len); }"
)]
extern "C" {
  fn on_extra_children_style(ptr: *const u16, len: usize);
}
