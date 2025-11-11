use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
  pub(crate) type MainThreadJSBinding;

  #[wasm_bindgen(method, js_name = "runWorklet")]
  pub(crate) fn run_worklet(
    this: &MainThreadJSBinding,
    handler: &wasm_bindgen::JsValue,
    event_object: &wasm_bindgen::JsValue,
  );

  #[wasm_bindgen(method, js_name = "enableEvent")]
  pub(crate) fn enable_event(this: &MainThreadJSBinding, event_name: &str);

}
