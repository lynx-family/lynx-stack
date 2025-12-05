use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
  pub type RustMainthreadContextBinding;

  #[wasm_bindgen(method, js_name = "runWorklet")]
  pub fn run_worklet(
    this: &RustMainthreadContextBinding,
    handler: &wasm_bindgen::JsValue,
    event_object: &wasm_bindgen::JsValue,
    target: &JsValue,
    current_target: &web_sys::HtmlElement,
  );

  #[wasm_bindgen(method, js_name = "publishEvent")]
  pub fn publish_event(
    this: &RustMainthreadContextBinding,
    handler_name: &str,
    event_object: &JsValue,
    target: &JsValue,
    current_target: &web_sys::HtmlElement,
  );

  #[wasm_bindgen(method, js_name = "publicComponentEvent")]
  pub fn public_component_event(
    this: &RustMainthreadContextBinding,
    component_id: &str,
    event_name: &str,
    event_object: &JsValue,
    target: &JsValue,
    current_target: &web_sys::HtmlElement,
  );

  #[wasm_bindgen(method, js_name = "getBubblePath")]
  pub fn get_bubble_path(this: &RustMainthreadContextBinding, event: &JsValue) -> Vec<usize>;

  #[wasm_bindgen(method, js_name = "addEventListener")]
  pub fn add_event_listener(this: &RustMainthreadContextBinding, event_name: &str);

  pub type JSEvent;
  #[wasm_bindgen(method, getter)]
  pub fn type_(this: &JSEvent) -> String;

  #[wasm_bindgen(method, getter)]
  pub fn target(this: &JSEvent) -> JsValue;

}
