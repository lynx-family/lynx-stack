use crate::js_binding::JSRealm;
use crate::template::TemplateManager;
use wasm_bindgen::prelude::*;

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
