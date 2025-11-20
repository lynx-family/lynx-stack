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
}
