use super::{LynxElement, MainThreadGlobalThis};
use crate::constants;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__GetClasses")]
  pub fn get_classes(&self, element: &LynxElement) -> js_sys::Array {
    let element_data = element.data.borrow();
    let dom = element_data.dom_ref.as_ref().unwrap();
    let class_list = dom.class_list();
    let array = js_sys::Array::new_with_length(class_list.length());
    for i in 0..class_list.length() {
      if let Some(class) = class_list.item(i) {
        array.set(i, class.into());
      }
    }
    array
  }

  #[wasm_bindgen(js_name = "__SetCSSId")]
  pub fn set_css_id(
    &self,
    #[wasm_bindgen(unchecked_param_type = "LynxElement[]")] elements: js_sys::Array,
    css_id: i32,
    entry_name: Option<String>,
  ) {
    let elements = wasm_bindgen_derive::try_from_js_array::<LynxElement>(elements).unwrap();
    for element in elements.iter().cloned() {
      let mut element_data = element.data.borrow_mut();
      if element_data.css_id != css_id {
        element_data.css_id = css_id;
        let dom = element_data.dom_ref.as_ref().unwrap();
        let _ = dom.set_attribute(constants::CSS_ID_ATTRIBUTE, css_id.to_string().as_str());
      }
      if let Some(entry_name) = &entry_name {
        if !entry_name.is_empty() {
          let dom = element_data.dom_ref.as_ref().unwrap();
          let _ = dom.set_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE, entry_name);
        }
      }
    }
  }

  #[wasm_bindgen(js_name = "__SetClasses")]
  pub fn set_classes(&self, element: &LynxElement, classname: Option<String>) {
    let element_data = element.data.borrow();
    let dom = element_data.dom_ref.as_ref().unwrap();
    if let Some(classname) = classname {
      let _ = dom.set_attribute("class", &classname);
    } else {
      let _ = dom.remove_attribute("class");
    }
  }

  // #[wasm_bindgen(js_name = __AddInlineStyle)]
  // pub fn add_inline_style(&self, element: &LynxElement, key: &wasm_bindgen::JsValue, value: &wasm_bindgen::JsValue) {
  //   let style = js_helpers::get_property(element.dom_ref.as_ref().unwrap(), "style").unwrap();
  //   js_helpers::get_function(&style, "setProperty")
  //       .unwrap()
  //       .call2(&style, key, value)
  //       .unwrap();
  // }

  #[wasm_bindgen(js_name = "__AddClass")]
  pub fn add_class(&self, element: &LynxElement, class_name: &str) {
    let element_data = element.data.borrow();
    element_data
      .dom_ref
      .as_ref()
      .unwrap()
      .class_list()
      .add_1(class_name)
      .unwrap();
  }

  // #[wasm_bindgen(js_name = __SetInlineStyles)]
  // pub fn set_inline_styles(&self, element: &LynxElement, value: &wasm_bindgen::JsValue) {
  //     let style = js_helpers::get_property(element.dom_ref.as_ref().unwrap(), "style").unwrap();
  //     js_helpers::set_property(&style, "cssText", value).unwrap();
  // }
}
