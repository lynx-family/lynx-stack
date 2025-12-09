use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
  pub type RustMainthreadContextBinding;

  #[wasm_bindgen(method, js_name = "runWorklet")]
  pub fn publish_mts_event(
    this: &RustMainthreadContextBinding,
    handler_name: &wasm_bindgen::JsValue,
    event_object: &wasm_bindgen::JsValue,
    target_element: &web_sys::HtmlElement,
    target_dataset: &wasm_bindgen::JsValue,
    current_target_element: &web_sys::HtmlElement,
    current_target_dataset: &wasm_bindgen::JsValue,
  );

  #[wasm_bindgen(method, js_name = "publishEvent")]
  pub fn publish_event(
    this: &RustMainthreadContextBinding,
    handler_name: &str,
    parent_component_id: Option<&str>,
    event_object: &wasm_bindgen::JsValue,
    target_element: &web_sys::HtmlElement,
    target_dataset: &wasm_bindgen::JsValue,
    current_target_element: &web_sys::HtmlElement,
    current_target_dataset: &wasm_bindgen::JsValue,
  );

  #[wasm_bindgen(method, js_name = "addEventListener")]
  pub fn add_event_listener(this: &RustMainthreadContextBinding, event_name: &str);

  #[wasm_bindgen(method, js_name = "loadInternalWebElement")]
  pub fn load_internal_web_element(this: &RustMainthreadContextBinding, element_id: usize);

  #[wasm_bindgen(method, js_name = "loadUnknownElement")]
  pub fn load_unknown_element(this: &RustMainthreadContextBinding, element_tag: &str);
}
