use wasm_bindgen::prelude::*;

struct Rpc {
  message_port: web_sys::MessagePort,
  name: String,
}

impl Rpc {
  pub fn new(message_port: web_sys::MessagePort, name: String) -> Rpc {
    // message_port.set_onmessage(

    // );
    Rpc { message_port, name }
  }

  pub fn on_message(&self, event: web_sys::MessageEvent) {
    let data = event.data();
    // is object
    if data.is_object() {
      let obj = js_sys::Object::from(data);
      let message_type_js_value = js_sys::Reflect::get(&obj, &JsValue::from_str("type")).unwrap();
      if js_sys::Number::is_integer(&message_type_js_value) {
        let message_type = message_type_js_value.as_f64().unwrap() as u32;
        let payload: js_sys::Uint8Array = js_sys::Reflect::get(&obj, &JsValue::from_str("payload"))
          .unwrap()
          .into();
        // copy payload to vec
        let mut payload_vec = vec![0; payload.length() as usize];
        payload.copy_to(&mut payload_vec[..]);
      }
    }
  }
}
