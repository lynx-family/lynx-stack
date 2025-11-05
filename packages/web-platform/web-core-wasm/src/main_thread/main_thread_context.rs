use super::mts_global_this::MainThreadGlobalThis;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(raw_module = "./bindGlobalThis.js")]
extern "C" {
  #[wasm_bindgen(js_name = "bindGlobalThis")]
  pub fn bind_global_this(global_this_obj: &JsValue, mts_global_this: &JsValue);
}

#[wasm_bindgen]
/**
 * The main thread context that holds all the necessary information for one lynx view.
 */
pub struct MainThreadContext {
  mts_global_this: MainThreadGlobalThis,
  js_realm: JSRealm,
}

impl MainThreadContext {
  /**
   * Creates a new `MainThreadContext`.
   */
  pub fn new(mts_global_this: MainThreadGlobalThis, js_realm: JSRealm) -> MainThreadContext {
    MainThreadContext {
      mts_global_this,
      js_realm,
    }
  }
}
