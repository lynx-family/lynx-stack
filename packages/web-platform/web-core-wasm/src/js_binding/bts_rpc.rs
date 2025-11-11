use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
  pub(crate) type BackgroundThreadRPC;

  #[wasm_bindgen(method, js_name = "triggerGlobalEventEmiter")]
  pub(crate) async fn trigger_global_event_emiter(
    this: &BackgroundThreadRPC,
    event_name: &str,
    data: Option<js_sys::Array>,
  );

  #[wasm_bindgen(method, js_name = "publishEvent")]
  pub(crate) async fn publish_event(
    this: &BackgroundThreadRPC,
    handler_name: &str,
    event_data: &JsValue,
  );

  #[wasm_bindgen(method, js_name = "publishComponentEvent")]
  pub(crate) async fn publish_component_event(
    this: &BackgroundThreadRPC,
    component_id: &str,
    event_name: &str,
    event_data: &JsValue,
  );

  #[wasm_bindgen(method, js_name = "postTimingFlags")]
  pub(crate) async fn post_timing_flag(
    this: &BackgroundThreadRPC,
    timing_flags: Vec<String>,
    pipeline_id: Option<&str>,
  );

  #[wasm_bindgen(method, js_name = "dispatchI18nResource")]
  pub(crate) async fn dispatch_i18n_resource(this: &BackgroundThreadRPC, resource: &JsValue);

  #[wasm_bindgen(method, js_name = "updateDataBackground")]
  pub(crate) async fn update_data_background(
    this: &BackgroundThreadRPC,
    new_data: &JsValue,
    options: &JsValue,
  );

  #[wasm_bindgen(method, js_name = "updateBackgroundJSModuleCache")]
  pub(crate) async fn update_background_js_module_cache(
    this: &BackgroundThreadRPC,
    module_name_to_url_map: &js_sys::Object,
  );

  #[wasm_bindgen(method, js_name = "dispatchJSContextInstanceEvent")]
  pub(crate) async fn dispatch_js_context_instance_event(
    this: &BackgroundThreadRPC,
    event_name: &str,
    event_data: &JsValue,
  );
}
