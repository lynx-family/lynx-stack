use super::{LynxElement, MainThreadGlobalThis};
use crate::constants;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__SetDataset")]
  pub fn set_dataset(&self, element: &mut LynxElement, dataset: &js_sys::Object) {
    element.replace_dataset(dataset);
  }

  #[wasm_bindgen(js_name = "__SetAttribute")]
  pub fn set_attribute(&mut self, element: &LynxElement, key: &str, value: wasm_bindgen::JsValue) {
    let unique_id = element.get_unique_id();
    let tag = element.get_tag();
    if key == "update-list-info" && tag == "list" {
      self.handle_update_list_info_attribute(element, value);
    } else if constants::EXPOSURE_RELATED_ATTRIBUTES.contains(key) {
      self.exposure_changed_elements.push(unique_id);
    } else {
      let value_str: Option<String> = if let Some(value) = value.as_string() {
        Some(value)
      } else if let Some(value_bool) = value.as_bool() {
        Some(if value_bool {
          "true".to_string()
        } else {
          "false".to_string()
        })
      } else {
        value.as_f64().map(|value_f64| value_f64.to_string())
      };
      if key == constants::LYNX_TIMING_FLAG {
        if let Some(value_str) = &value_str {
          self.timing_flags.push(value_str.clone());
        }
      } else {
        let _ = element.set_or_remove_attribute(key, value_str.as_deref());
      }
    }
  }

  /**
   * Get the unique ID of the element
   * It has a special feature:
   * if the element is not a LynxElement, it will return -1
   * But after benchmarking, casting JsValue to LynxElement dynamically is very slow.
   * So we provide a pure Rust version of this function for internal use.
   * It should be wrapped by a JS function that does the type checking first.
   */
  #[wasm_bindgen(js_name = "__wasm_binding__GetElementUniqueID")]
  pub fn get_element_unique_id_pure(&self, element: &LynxElement) -> i32 {
    element.get_unique_id()
  }

  #[wasm_bindgen(js_name = "__SwapElement")]
  pub fn swap_element(&mut self, child_a: &LynxElement, child_b: &LynxElement) {
    let temp = self.document.create_element("div").unwrap();
    let child_a_dom = child_a.get_dom();
    let child_b_dom = child_b.get_dom();
    child_a_dom.replace_with_with_node_1(&temp).unwrap();
    child_b_dom.replace_with_with_node_1(&child_a_dom).unwrap();
    temp.replace_with_with_node_1(&child_b_dom).unwrap();
  }

  #[wasm_bindgen(js_name = "__GetPageElement")]
  pub fn get_page_element(&self) -> Option<LynxElement> {
    self.page.clone()
  }

  #[wasm_bindgen(js_name = "__AppendElement")]
  pub fn append_element(&self, parent: &LynxElement, child: &LynxElement) {
    let parent_dom = parent.get_dom();
    let child_dom = child.get_dom();
    parent_dom.append_child(&child_dom).unwrap();
  }

  #[wasm_bindgen(js_name = "__wasm_binding_ElementIsEqual")]
  pub fn element_is_equal(&self, left: &LynxElement, right: &LynxElement) -> bool {
    left.get_unique_id() == right.get_unique_id()
  }

  #[wasm_bindgen(js_name = "__FirstElement")]
  pub fn first_element(&self, element: &LynxElement) -> Option<LynxElement> {
    element
      .get_dom()
      .first_element_child()
      .and_then(|e| self.get_lynx_element_by_dom(&e.unchecked_into()).cloned())
  }

  #[wasm_bindgen(js_name = "__GetChildren")]
  pub fn get_children(&self, element: &LynxElement) -> Vec<LynxElement> {
    let children = element.get_dom().children();
    let mut array = Vec::new();
    let children_length = children.length();
    for i in 0..children_length {
      let child = children.item(i).unwrap();
      if let Some(element) = self.get_lynx_element_by_dom(&child.unchecked_into()) {
        array.push(element.clone());
      }
    }
    array
  }

  #[wasm_bindgen(js_name = "__GetParent")]
  pub fn get_parent(&self, element: &LynxElement) -> Option<LynxElement> {
    let parent_dom_option = element.get_dom().parent_element();
    if let Some(parent_dom) = parent_dom_option {
      self
        .get_lynx_element_by_dom(&parent_dom.unchecked_into())
        .cloned()
    } else {
      None
    }
  }

  #[wasm_bindgen(js_name = "__InsertElementBefore")]
  pub fn insert_element_before(
    &self,
    parent: &LynxElement,
    child: &LynxElement,
    ref_node: &wasm_bindgen::JsValue,
  ) {
    let parent_dom = parent.get_dom();
    let child_dom = child.get_dom();

    if !ref_node.is_null_or_undefined() {
      let ref_node = wasm_bindgen_derive::try_from_js_option::<LynxElement>(ref_node)
        .unwrap()
        .unwrap();
      let ref_node_dom = ref_node.get_dom();
      parent_dom
        .insert_before(&child_dom, Some(&ref_node_dom))
        .unwrap();
    } else {
      parent_dom.insert_before(&child_dom, None).unwrap();
    };
  }

  #[wasm_bindgen(js_name = "__LastElement")]
  pub fn last_element(&self, element: &LynxElement) -> Option<LynxElement> {
    let dom = element.get_dom();
    dom
      .last_element_child()
      .and_then(|e| self.get_lynx_element_by_dom(&e.unchecked_into()).cloned())
  }

  #[wasm_bindgen(js_name = "__NextElement")]
  pub fn next_element(&self, element: &LynxElement) -> Option<LynxElement> {
    let dom = element.get_dom();
    dom
      .next_element_sibling()
      .and_then(|e| self.get_lynx_element_by_dom(&e.unchecked_into()).cloned())
  }

  #[wasm_bindgen(js_name = "__RemoveElement")]
  pub fn remove_element(&self, parent: &LynxElement, child: &LynxElement) {
    let parent_dom = parent.get_dom();
    let child_dom = child.get_dom();
    parent_dom.remove_child(&child_dom).unwrap();
  }

  #[wasm_bindgen(js_name = "__ReplaceElement")]
  pub fn replace_element(&self, new_element: &LynxElement, old_element: &LynxElement) {
    let new_element_dom = new_element.get_dom();
    let old_element_dom = old_element.get_dom();
    let _ = old_element_dom.replace_with_with_node_1(&new_element_dom);
  }

  #[wasm_bindgen(js_name = "__ReplaceElements")]
  pub fn replace_elements(
    &self,
    parent: &LynxElement,
    new_children: &wasm_bindgen::JsValue,
    old_children: &wasm_bindgen::JsValue,
  ) {
    let new_children: js_sys::Array = {
      // the new_children could be 1. array of LynxElement 2. single LynxElement
      if new_children.is_array() {
        js_sys::Array::from_iter(
          wasm_bindgen_derive::try_from_js_array::<LynxElement>(new_children)
            .unwrap()
            .iter()
            .map(|element| {
              let dom = element.get_dom();
              wasm_bindgen::JsValue::from(dom)
            }),
        )
      } else if new_children.is_object() {
        let arr = js_sys::Array::new();
        arr.push(&{
          let element = wasm_bindgen_derive::try_from_js_option::<LynxElement>(new_children)
            .unwrap()
            .unwrap();
          let dom = element.get_dom();
          wasm_bindgen::JsValue::from(dom)
        });
        arr
      } else {
        return;
      }
    };
    let parent_dom = parent.get_dom();
    if old_children.is_falsy() {
      // just append new children
      let _ = parent_dom.append_with_node(&new_children);
    } else if !old_children.is_array() {
      // old_children is a single LynxElement
      let old_child_element = wasm_bindgen_derive::try_from_js_option::<LynxElement>(old_children)
        .unwrap()
        .unwrap();
      let old_child_dom = old_child_element.get_dom();
      old_child_dom.replace_with_with_node(&new_children).unwrap();
    } else {
      let old_children =
        wasm_bindgen_derive::try_from_js_array::<LynxElement>(old_children).unwrap();
      for (ii, old_child) in old_children.iter().enumerate() {
        let old_child_dom = old_child.get_dom();
        if ii == 0 {
          let _ = old_child_dom.replace_with_with_node(&new_children);
        } else {
          parent_dom.remove_child(&old_child_dom).unwrap();
        }
      }
    }
  }

  #[wasm_bindgen(js_name = "__AddConfig")]
  pub fn add_config(&mut self, element: &LynxElement, type_: &str, value: &wasm_bindgen::JsValue) {
    element.set_component_config(type_, value);
  }

  #[wasm_bindgen(js_name = "__AddDataset")]
  pub fn add_dataset(&self, element: &LynxElement, key: &str, value: &wasm_bindgen::JsValue) {
    element.set_dataset(key, value);
  }

  #[wasm_bindgen(js_name = "__GetDataset")]
  pub fn get_dataset(&self, element: &LynxElement) -> js_sys::Object {
    element.get_dataset_js_object()
  }

  #[wasm_bindgen(js_name = "__GetDataByKey")]
  pub fn get_data_by_key(&self, element: &LynxElement, key: &str) -> wasm_bindgen::JsValue {
    element.get_dataset(key)
  }

  #[wasm_bindgen(js_name = "__GetAttributeByName")]
  pub fn get_attribute_by_name(&self, element: &LynxElement, name: &str) -> Option<String> {
    element.get_attribute(name)
  }

  #[wasm_bindgen(js_name = "__GetAttributes")]
  pub fn get_attributes(&self, element: &LynxElement) -> Vec<js_sys::Array> {
    let dom = element.get_dom();
    let attrs = dom.attributes();
    let mut entries = Vec::new();
    for i in 0..attrs.length() {
      if let Some(attr) = attrs.item(i) {
        let name = attr.name();
        let value = attr.value();
        entries.push(js_sys::Array::of2(
          &wasm_bindgen::JsValue::from_str(&name),
          &wasm_bindgen::JsValue::from_str(&value),
        ));
      }
    }
    entries
  }

  #[wasm_bindgen(js_name = "__GetID")]
  pub fn get_id(&self, element: &LynxElement) -> Option<String> {
    element.get_id()
  }

  #[wasm_bindgen(js_name = "__SetID")]
  pub fn set_id(&self, element: &LynxElement, id: Option<String>) {
    element.set_id(id);
  }

  #[wasm_bindgen(js_name = "__GetTag")]
  pub fn get_tag(&self, element: &LynxElement) -> String {
    element.get_tag()
  }
}
