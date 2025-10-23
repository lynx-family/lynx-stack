use wasm_bindgen::prelude::*;

#[wasm_bindgen]
struct Rpc {
  message_port: web_sys::MessagePort,
  name: String,
}

#[wasm_bindgen]
impl Rpc {
  #[wasm_bindgen(constructor)]
  pub fn new(message_port: web_sys::MessagePort, name: String) -> Rpc {
    Rpc { message_port, name }
  }

  pub fn on_message(id: i32, data: js_sys::ArrayBuffer) {}
}
