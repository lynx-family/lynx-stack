use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
  pub type JSRealm;

  #[wasm_bindgen(getter, method, js_name = "globalWindow")]
  pub fn getGlobalThis(this: &JSRealm) -> web_sys::Window;

  #[wasm_bindgen(catch, method, js_name = "loadScriptSync")]
  pub fn loadScriptSync(this: &JSRealm, url: &str) -> Result<JsValue, JsValue>;

  #[wasm_bindgen(catch, method, js_name = "loadScript")]
  pub async fn loadScript(this: &JSRealm, url: &str) -> Result<JsValue, JsValue>;

}
