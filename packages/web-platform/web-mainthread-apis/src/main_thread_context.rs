use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct MainThreadContext {
  // Fields go here
}

#[wasm_bindgen]
impl MainThreadContext {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    MainThreadContext {
            // Initialize fields here
        }
  }
}
