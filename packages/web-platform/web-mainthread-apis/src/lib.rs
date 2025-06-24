use wasm_bindgen::prelude::*;

pub mod css;
pub mod transformer;
// lifted from the `console_log` example
/**
accept a raw uint16 ptr from JS
*/
#[wasm_bindgen]
pub fn accept_raw_uint16_ptr(ptr: *const u16, len: usize) {
  // Safety: We assume the pointer is valid and points to a slice of u16
  // of length `len`. This is a contract with the JavaScript side.
  unsafe {
    let slice = core::slice::from_raw_parts(ptr, len);
    // Call the tokenize function with our data and callback
    let result = transformer::transformer::transform_inline_style_string(&slice);
    if !result.is_empty() {
      let ptr = result.as_ptr();
      on_transformed(ptr, result.len());
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
