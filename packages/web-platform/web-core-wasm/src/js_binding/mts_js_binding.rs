use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
  pub type MainThreadJSBinding;

  #[wasm_bindgen(method, js_name = "runWorklet")]
  pub fn run_worklet(
    this: &MainThreadJSBinding,
    handler: &wasm_bindgen::JsValue,
    event_object: &wasm_bindgen::JsValue,
    target: &web_sys::HtmlElement,
    current_target: &web_sys::HtmlElement,
  );

  #[wasm_bindgen(method, js_name = "enableEvent")]
  pub fn enable_event(this: &MainThreadJSBinding, event_name: &str);

  #[wasm_bindgen(method, js_name = "triggerGlobalEventEmiter")]
  pub async fn trigger_global_event_emiter(
    this: &MainThreadJSBinding,
    event_name: &str,
    data: Option<js_sys::Array>,
  );

  #[wasm_bindgen(method, js_name = "publishEvent")]
  pub fn publish_event(
    this: &MainThreadJSBinding,
    handler_name: &str,
    event_data: &JsValue,
    target: &web_sys::HtmlElement,
    current_target: &web_sys::HtmlElement,
  );

  #[wasm_bindgen(method, js_name = "publicComponentEvent")]
  pub fn public_component_event(
    this: &MainThreadJSBinding,
    component_id: &str,
    event_name: &str,
    event_data: &JsValue,
    target: &web_sys::HtmlElement,
    current_target: &web_sys::HtmlElement,
  );

  #[wasm_bindgen(method, js_name = "postTimingFlags")]
  pub fn post_timing_flag(
    this: &MainThreadJSBinding,
    timing_flags: Vec<String>,
    pipeline_id: Option<&str>,
  );

  #[wasm_bindgen(method, js_name = "dispatchI18nResource")]
  pub fn dispatch_i18n_resource(this: &MainThreadJSBinding, resource: &JsValue);

  #[wasm_bindgen(method, js_name = "updateDataBackground")]
  pub fn update_data_background(this: &MainThreadJSBinding, new_data: &JsValue, options: &JsValue);

  #[wasm_bindgen(method, js_name = "updateBackgroundJSModuleCache")]
  pub async fn update_background_js_module_cache(
    this: &MainThreadJSBinding,
    module_name_to_url_map: &js_sys::Object,
  );

  #[wasm_bindgen(method, js_name = "dispatchJSContextInstanceEvent")]
  pub async fn dispatch_js_context_instance_event(
    this: &MainThreadJSBinding,
    event_name: &str,
    event_data: &JsValue,
  );
}
