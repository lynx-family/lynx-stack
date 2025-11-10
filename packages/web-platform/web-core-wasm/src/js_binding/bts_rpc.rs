use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
  pub(crate) type BackgroundThreadRPC;

  #[wasm_bindgen(method, js_name = "triggerGlobalEventEmiter")]
  pub(crate) fn trigger_global_event_emiter(
    this: &BackgroundThreadRPC,
    event_name: &str,
    data: Option<js_sys::Array>,
  );

  #[wasm_bindgen(method, js_name = "publishEvent")]
  pub(crate) fn publish_event(this: &BackgroundThreadRPC, handler_name: &str, event_data: &JsValue);

  #[wasm_bindgen(method, js_name = "publishComponentEvent")]
  pub(crate) fn publish_component_event(
    this: &BackgroundThreadRPC,
    component_id: &str,
    event_name: &str,
    event_data: &JsValue,
  );

  #[wasm_bindgen(method, js_name = "postTimingFlags")]
  pub(crate) fn post_timing_flag(
    this: &BackgroundThreadRPC,
    timing_flags: Vec<String>,
    pipeline_id: Option<&str>,
  );

  #[wasm_bindgen(method, js_name = "dispatchI18nResource")]
  pub(crate) fn dispatch_i18n_resource(this: &BackgroundThreadRPC, resource: &JsValue);

  #[wasm_bindgen(method, js_name = "updateDataBackground")]
  pub(crate) fn update_data_background(
    this: &BackgroundThreadRPC,
    new_data: &JsValue,
    options: &JsValue,
  );

  // #[wasm_bindgen(method, js_name = "updateBackgroundJSModuleCache")]
  // pub(crate) fn update_background_js_module_cache(
  //   this: &BackgroundThreadRPC,
  //   module_name_to_url_map: HashMap<String, String>,
  // );
}
