use wasm_bindgen::prelude::*;

pub mod css;
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
    css::parse_inline_style::parse_inline_style(slice, on_declaration);
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
  inline_js = "export function on_declaration(nS, nE, vS, vE, im) { globalThis._tokenizer_on_declaration_callback(nS, nE, vS, vE, im); }"
)]
extern "C" {
  fn on_declaration(
    name_start: usize,
    name_end: usize,
    value_start: usize,
    value_end: usize,
    is_important: bool,
  );
}
