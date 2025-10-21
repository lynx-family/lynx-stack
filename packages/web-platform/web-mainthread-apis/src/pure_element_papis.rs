use js_sys::{Array, Object};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(raw_module = "./pureElementPAPIs.js")]
extern "C" {
  #[wasm_bindgen(js_name = __AppendElement)]
  pub fn append_element(parent: &web_sys::Element, child: &web_sys::Element);

  #[wasm_bindgen(js_name = __ElementIsEqual)]
  pub fn element_is_equal(left: &web_sys::Element, right: &web_sys::Element) -> bool;

  #[wasm_bindgen(js_name = __FirstElement)]
  pub fn first_element(element: &web_sys::Element) -> Option<web_sys::Element>;

  #[wasm_bindgen(js_name = __GetChildren)]
  pub fn get_children(element: &web_sys::Element) -> Option<Array>;

  #[wasm_bindgen(js_name = __GetParent)]
  pub fn get_parent(element: &web_sys::Element) -> Option<web_sys::Element>;

  #[wasm_bindgen(js_name = __InsertElementBefore)]
  pub fn insert_element_before(
    parent: &web_sys::Element,
    child: &web_sys::Element,
    ref_node: &web_sys::Element,
  );

  #[wasm_bindgen(js_name = __LastElement)]
  pub fn last_element(element: &web_sys::Element) -> Option<web_sys::Element>;

  #[wasm_bindgen(js_name = __NextElement)]
  pub fn next_element(element: &web_sys::Element) -> Option<web_sys::Element>;

  #[wasm_bindgen(js_name = __RemoveElement)]
  pub fn remove_element(parent: &web_sys::Element, child: &web_sys::Element);

  #[wasm_bindgen(js_name = __ReplaceElement)]
  pub fn replace_element(new_element: &web_sys::Element, old_element: &web_sys::Element);

  #[wasm_bindgen(js_name = __ReplaceElements)]
  pub fn replace_elements(parent: &web_sys::Element, new_children: &Array, old_children: &Array);

  #[wasm_bindgen(js_name = __AddConfig)]
  pub fn add_config(element: &web_sys::Element, type_: &str, value: &JsValue);

  #[wasm_bindgen(js_name = __AddDataset)]
  pub fn add_dataset(element: &web_sys::Element, key: &str, value: &JsValue);

  #[wasm_bindgen(js_name = __GetDataset)]
  pub fn get_dataset(element: &web_sys::Element) -> Object;

  #[wasm_bindgen(js_name = __GetDataByKey)]
  pub fn get_data_by_key(element: &web_sys::Element, key: &str) -> JsValue;

  #[wasm_bindgen(js_name = __GetAttributes)]
  pub fn get_attributes(element: &web_sys::Element) -> Object;

  #[wasm_bindgen(js_name = __GetComponentID)]
  pub fn get_component_id(element: &web_sys::Element) -> Option<String>;

  #[wasm_bindgen(js_name = __GetElementConfig)]
  pub fn get_element_config(element: &web_sys::Element) -> Object;

  #[wasm_bindgen(js_name = __GetAttributeByName)]
  pub fn get_attribute_by_name(element: &web_sys::Element, name: &str) -> Option<String>;

  #[wasm_bindgen(js_name = __GetElementUniqueID)]
  pub fn get_element_unique_id(element: &web_sys::Element) -> i32;

  #[wasm_bindgen(js_name = __GetID)]
  pub fn get_id(element: &web_sys::Element) -> Option<String>;

  #[wasm_bindgen(js_name = __SetID)]
  pub fn set_id(element: &web_sys::Element, id: &str);

  #[wasm_bindgen(js_name = __GetTag)]
  pub fn get_tag(element: &web_sys::Element) -> String;

  #[wasm_bindgen(js_name = __SetConfig)]
  pub fn set_config(element: &web_sys::Element, config: &Object);

  #[wasm_bindgen(js_name = __SetDataset)]
  pub fn set_dataset(element: &web_sys::Element, dataset: &Object);

  #[wasm_bindgen(js_name = __UpdateComponentID)]
  pub fn update_component_id(element: &web_sys::Element, component_id: &str);

  #[wasm_bindgen(js_name = __GetClasses)]
  pub fn get_classes(element: &web_sys::Element) -> Array;

  #[wasm_bindgen(js_name = __UpdateComponentInfo)]
  pub fn update_component_info(element: &web_sys::Element, params: &Object);

  #[wasm_bindgen(js_name = __SetCSSId)]
  pub fn set_css_id(elements: &Array, css_id: &str, entry_name: &str);

  #[wasm_bindgen(js_name = __SetClasses)]
  pub fn set_classes(element: &web_sys::Element, classname: &str);

  #[wasm_bindgen(js_name = __AddInlineStyle)]
  pub fn add_inline_style(element: &web_sys::Element, key: &JsValue, value: &JsValue);

  #[wasm_bindgen(js_name = __AddClass)]
  pub fn add_class(element: &web_sys::Element, class_name: &str);

  #[wasm_bindgen(js_name = __SetInlineStyles)]
  pub fn set_inline_styles(element: &web_sys::Element, value: &JsValue);

  #[wasm_bindgen(js_name = __GetTemplateParts)]
  pub fn get_template_parts(template_element: &web_sys::Element) -> Object;

  #[wasm_bindgen(js_name = __MarkTemplateElement)]
  pub fn mark_template_element(element: &web_sys::Element);

  #[wasm_bindgen(js_name = __MarkPartElement)]
  pub fn mark_part_element(element: &web_sys::Element, part_id: &str);

  #[wasm_bindgen(js_name = __UpdateListCallbacks)]
  pub fn update_list_callbacks(
    element: &web_sys::Element,
    component_at_index: &JsValue,
    enqueue_component: &JsValue,
  );
}
