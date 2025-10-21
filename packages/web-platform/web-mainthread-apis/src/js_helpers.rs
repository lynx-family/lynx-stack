use wasm_bindgen::prelude::*;

#[wasm_bindgen(raw_module = "./rustHelpers.js")]
extern "C" {
  pub fn create_element_js_impl(
    document: &wasm_bindgen::JsValue,
    tag: &wasm_bindgen::JsValue,
    unique_id: i32,
  ) -> web_sys::Element;

  pub fn prepare_component_element_js_impl(
    component_element: &web_sys::Element,
    component_id: &wasm_bindgen::JsValue,
    css_id: i32,
    name: &wasm_bindgen::JsValue,
  );

  pub fn update_list_info_js_impl(
    list_element: &web_sys::Element,
    unique_id: i32,
    list_info: &wasm_bindgen::JsValue,
  );

  #[wasm_bindgen(js_name = "set_attribute_js_impl")]
  pub fn set_attribute_js_impl(
    element: &web_sys::Element,
    name: &wasm_bindgen::JsValue,
    value: &wasm_bindgen::JsValue,
  );

}
