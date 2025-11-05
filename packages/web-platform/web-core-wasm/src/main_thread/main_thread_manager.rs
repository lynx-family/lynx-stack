use std::collections::HashMap;
use wasm_bindgen::prelude::*;
// use super::main_thread_context::MainThreadContext;
use crate::template::TemplateManager;

#[wasm_bindgen]
extern "C" {
  pub type JSRealm;

  #[wasm_bindgen(getter, js_name = "globalThis")]
  pub fn getGlobalThis(this: &JSRealm) -> web_sys::Window;

  #[wasm_bindgen(catch, method, js_name = "loadScriptSync")]
  pub fn loadScriptSync(this: &JSRealm, url: &str) -> Result<JsValue, JsValue>;

  #[wasm_bindgen(catch, method, js_name = "loadScript")]
  pub async fn loadScript(this: &JSRealm, url: &str) -> Result<JsValue, JsValue>;
}

#[wasm_bindgen]
#[derive(Default)]
/**
 * The main thread render.
 * this struct is supposed to have only one instance in wasm memory.
 */
pub struct MainThreadManager {
  template_manager: TemplateManager,
}

impl MainThreadManager {
  /**
   * Creates a new `MainThreadManager`.
   */
  pub fn new() -> MainThreadManager {
    MainThreadManager {
      template_manager: TemplateManager::new(),
    }
  }

  pub fn start_main_thread(
    template_url: String,
    init_data: JsValue,
    global_props: JsValue,
    shadow_root: web_sys::Node,
    custom_template_loader: js_sys::Function,
    mts_realm: JSRealm,
  ) {
  }
}
