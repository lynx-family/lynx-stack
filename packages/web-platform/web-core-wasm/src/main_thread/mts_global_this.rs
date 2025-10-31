use crate::{
  constants, js_helpers,
  main_thread::element::{self, LynxElement},
};
use js_sys::{Array, Object};
use std::{collections::HashMap, rc::Rc, vec};
use wasm_bindgen::{
  convert::{IntoWasmAbi, TryFromJsValue},
  prelude::*,
};

#[wasm_bindgen]
pub struct MainThreadGlobalThis {
  unique_id_counter: i32,
  pub(crate) unique_id_to_element_data_map: HashMap<i32, Box<LynxElement>>,
  pub(crate) unique_id_to_config_map: HashMap<i32, HashMap<String, String>>,
  tag_name_to_html_tag_map: HashMap<String, String>,
  timing_flags: Vec<String>,
  document: web_sys::Document,
  root_node: web_sys::Node,
  page: Option<LynxElement>,
  exposure_changed_elements: Vec<i32>,
  config_enable_css_selector: bool,
  config_enable_remove_css_scope: bool,
  config_default_display_linear: bool,
  config_default_overflow_visible: bool,
  config_enable_js_dataprocessor: bool,
}

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(constructor)]
  pub fn new(
    tag_name_to_html_tag_map: wasm_bindgen::JsValue,
    document: web_sys::Document,
    root_node: web_sys::Node,
    enable_css_selector: bool,
    enable_remove_css_scope: bool,
    default_display_linear: bool,
    default_overflow_visible: bool,
    enable_js_dataprocessor: bool,
  ) -> MainThreadGlobalThis {
    let unique_id_counter = 1;
    let tag_name_to_html_tag_map: HashMap<String, String> =
      serde_wasm_bindgen::from_value(tag_name_to_html_tag_map).unwrap();
    MainThreadGlobalThis {
      unique_id_counter,
      unique_id_to_element_data_map: HashMap::new(),
      unique_id_to_config_map: HashMap::new(),
      timing_flags: vec![],
      document,
      tag_name_to_html_tag_map,
      exposure_changed_elements: vec![],
      page: None,
      root_node,
      config_enable_css_selector: enable_css_selector,
      config_enable_remove_css_scope: enable_remove_css_scope,
      config_default_display_linear: default_display_linear,
      config_default_overflow_visible: default_overflow_visible,
      config_enable_js_dataprocessor: enable_js_dataprocessor,
    }
  }

  #[wasm_bindgen(js_name = "__CreateElement")]
  pub fn create_element(
    &mut self,
    tag: &str,
    parent_component_unique_id: i32,
  ) -> wasm_bindgen::JsValue {
    self
      .create_element_impl(tag, parent_component_unique_id, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateView")]
  pub fn create_view(&mut self, parent_component_unique_id: i32) -> wasm_bindgen::JsValue {
    self
      .create_element_impl("view", parent_component_unique_id, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateText")]
  pub fn create_text(&mut self, parent_component_unique_id: i32) -> wasm_bindgen::JsValue {
    self
      .create_element_impl("text", parent_component_unique_id, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateRawText")]
  pub fn create_raw_text(&mut self, text: &str) -> wasm_bindgen::JsValue {
    let element = self.create_element_impl("raw-text", -1, None);
    let _ = element
      .dom_ref
      .as_ref()
      .unwrap()
      .set_attribute("text", text);
    element.self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateImage")]
  pub fn create_image(&mut self, parent_component_unique_id: i32) -> wasm_bindgen::JsValue {
    self
      .create_element_impl("image", parent_component_unique_id, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateScrollView")]
  pub fn create_scroll_view(&mut self, parent_component_unique_id: i32) -> wasm_bindgen::JsValue {
    self
      .create_element_impl("scroll-view", parent_component_unique_id, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateWrapperElement")]
  pub fn create_wrapper_element(
    &mut self,
    parent_component_unique_id: i32,
  ) -> wasm_bindgen::JsValue {
    self
      .create_element_impl("lynx-wrapper", parent_component_unique_id, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreatePage")]
  pub fn create_page(&mut self, component_id: &str, css_id: i32) -> wasm_bindgen::JsValue {
    let page = self.create_element_impl("page", 0, None);
    let _ = page.dom_ref.as_ref().unwrap().set_attribute("part", "page");
    let _ = page
      .dom_ref
      .as_ref()
      .unwrap()
      .set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
    let _ = page
      .dom_ref
      .as_ref()
      .unwrap()
      .set_attribute(constants::COMPONENT_ID_ATTRIBUTE, component_id);
    self.mark_template_element(&page);
    if !self.config_default_display_linear {
      let _ = page
        .dom_ref
        .as_ref()
        .unwrap()
        .set_attribute(constants::LYNX_DEFAULT_DISPLAY_LINEAR_ATTRIBUTE, "false");
    }
    if self.config_default_overflow_visible {
      let _ = page
        .dom_ref
        .as_ref()
        .unwrap()
        .set_attribute(constants::LYNX_DEFAULT_OVERFLOW_VISIBLE_ATTRIBUTE, "true");
    }
    // the page element is supposed to leak because it's the root of the app
    self.page = Some(page.clone());
    page.self_js_value
  }

  #[wasm_bindgen(js_name = "__MarkTemplateElement")]
  pub fn mark_template_element(&mut self, element: &LynxElement) {
    let _ = element
      .dom_ref
      .as_ref()
      .unwrap()
      .set_attribute(constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE, "true");
  }

  #[wasm_bindgen(js_name = "__CreateComponent")]
  pub fn create_component(
    &mut self,
    component_parent_unique_id: i32,
    component_id: &str,
    css_id: i32,
  ) -> wasm_bindgen::JsValue {
    let component = self.create_element_impl("view", component_parent_unique_id, Some(css_id));
    let dom = component.dom_ref.as_ref().unwrap();
    let _ = dom.set_attribute(constants::COMPONENT_ID_ATTRIBUTE, component_id);
    component.self_js_value
  }

  #[wasm_bindgen(js_name = "__SetAttribute")]
  pub fn set_attribute(&mut self, element: &LynxElement, key: &str, value: wasm_bindgen::JsValue) {
    let element_data = element.data.borrow();
    let unique_id = element_data.unique_id;
    let tag = element_data.tag.as_str();
    if key == "update-list-info" && tag == "list" {
      self.handle_update_list_info_attribute(element, value);
    } else if let Some(value) = value.as_string() {
      if key == constants::LYNX_TIMING_FLAG {
        // do not set attributes for timing flag, just record it
        self.timing_flags.push(value);
      } else {
        let dom = element.dom_ref.as_ref().unwrap();
        let _ = dom.set_attribute(key, &value);
        if constants::EXPOSURE_RELATED_ATTRIBUTES.contains(key) {
          self.exposure_changed_elements.push(unique_id);
        }
      }
    }
  }

  #[wasm_bindgen(js_name = "__GetElementUniqueId")]
  pub fn get_element_unique_id(&self, element: &LynxElement) -> i32 {
    element.data.borrow().unique_id
  }

  #[wasm_bindgen(js_name = "__SwapElement")]
  pub fn swap_element(&mut self, child_a: &LynxElement, child_b: &LynxElement) {
    let temp = self.document.create_element("div").unwrap();
    let child_a_dom = child_a.dom_ref.as_ref().unwrap();
    let child_b_dom = child_b.dom_ref.as_ref().unwrap();
    child_a_dom.replace_with_with_node_1(&temp).unwrap();
    child_b_dom.replace_with_with_node_1(child_a_dom).unwrap();
    temp.replace_with_with_node_1(child_b_dom).unwrap();
  }

  #[wasm_bindgen(js_name = "__GetPageElement")]
  pub fn get_page_element(&self) -> Option<wasm_bindgen::JsValue> {
    self.page.clone().map(|e| e.self_js_value)
  }

  #[wasm_bindgen(js_name = __AppendElement)]
  pub fn append_element(&self, parent: &LynxElement, child: &LynxElement) {
    let parent_dom = parent.dom_ref.as_ref().unwrap();
    let child_dom = child.dom_ref.as_ref().unwrap();
    parent_dom.append_child(child_dom).unwrap();
  }

  #[wasm_bindgen(js_name = __ElementIsEqual)]
  pub fn element_is_equal(&self, left: &LynxElement, right: &LynxElement) -> bool {
    left
      .dom_ref
      .as_ref()
      .unwrap()
      .is_equal_node(Some(right.dom_ref.as_ref().unwrap()))
  }

  #[wasm_bindgen(js_name = __FirstElement)]
  pub fn first_element(&self, element: &LynxElement) -> Option<wasm_bindgen::JsValue> {
    element
      .dom_ref
      .as_ref()
      .unwrap()
      .first_element_child()
      .and_then(|e| {
        self
          .get_lynx_element_by_dom(&e)
          .map(|b| b.self_js_value.clone())
      })
  }

  #[wasm_bindgen(js_name = __GetChildren)]
  pub fn get_children(&self, element: &LynxElement) -> js_sys::Array {
    let children = element.dom_ref.as_ref().unwrap().children();
    let array = js_sys::Array::new();
    let children_length = children.length();
    for i in 0..children_length {
      let child = children.item(i).unwrap();
      if let Some(element) = self.get_lynx_element_by_dom(&child) {
        let element: wasm_bindgen::JsValue = element.self_js_value.clone();
        array.push(&element);
      }
    }
    array
  }

  #[wasm_bindgen(js_name = __GetParent)]
  pub fn get_parent(&self, element: &LynxElement) -> Option<wasm_bindgen::JsValue> {
    let parent_dom_option = element.dom_ref.as_ref().unwrap().parent_element();
    if let Some(parent_dom) = parent_dom_option {
      self
        .get_lynx_element_by_dom(&parent_dom)
        .map(|element| element.self_js_value.clone())
    } else {
      None
    }
  }

  #[wasm_bindgen(js_name = __InsertElementBefore)]
  pub fn insert_element_before(
    &self,
    parent: &LynxElement,
    child: &LynxElement,
    ref_node: &LynxElement,
  ) {
    let parent_dom = parent.dom_ref.as_ref().unwrap();
    let child_dom = child.dom_ref.as_ref().unwrap();
    let ref_node_dom = ref_node.dom_ref.as_ref().map(|e| e as &web_sys::Node);
    parent_dom.insert_before(child_dom, ref_node_dom).unwrap();
  }

  #[wasm_bindgen(js_name = __LastElement)]
  pub fn last_element(&self, element: &LynxElement) -> Option<wasm_bindgen::JsValue> {
    element
      .dom_ref
      .as_ref()
      .unwrap()
      .last_element_child()
      .and_then(|e| {
        self
          .get_lynx_element_by_dom(&e)
          .map(|b| b.self_js_value.clone())
      })
  }

  #[wasm_bindgen(js_name = __NextElement)]
  pub fn next_element(&self, element: &LynxElement) -> Option<wasm_bindgen::JsValue> {
    element
      .dom_ref
      .as_ref()
      .unwrap()
      .next_element_sibling()
      .and_then(|e| {
        self
          .get_lynx_element_by_dom(&e)
          .map(|b| b.self_js_value.clone())
      })
  }

  #[wasm_bindgen(js_name = __RemoveElement)]
  pub fn remove_element(&self, parent: &LynxElement, child: &LynxElement) {
    let parent_dom = parent.dom_ref.as_ref().unwrap();
    let child_dom = child.dom_ref.as_ref().unwrap();
    parent_dom.remove_child(child_dom).unwrap();
  }

  #[wasm_bindgen(js_name = __ReplaceElement)]
  pub fn replace_element(&self, new_element: &LynxElement, old_element: &LynxElement) {
    let old_element_dom = old_element.dom_ref.as_ref().unwrap();
    let new_element_dom = new_element.dom_ref.as_ref().unwrap();
    old_element_dom
      .replace_with_with_node_1(new_element_dom)
      .unwrap();
  }

  #[wasm_bindgen(js_name = __ReplaceElements)]
  pub fn replace_elements(
    &self,
    parent: &LynxElement,
    new_children: &wasm_bindgen::JsValue,
    old_children: &wasm_bindgen::JsValue,
  ) {
    let new_children: js_sys::Array = {
      // the new_children could be 1. array of LynxElement 2. single LynxElement
      if new_children.is_array() {
        let new_children_array: js_sys::Array = js_sys::Array::from(new_children);
        new_children_array.map(&mut |lynx_element, _, _| {
          let lynx_element = LynxElement::try_from_js_value(lynx_element).unwrap();
          let dom = lynx_element.dom_ref.clone().unwrap();
          dom.into()
        })
      } else if new_children.is_object() {
        let arr = js_sys::Array::new();
        arr.push(
          &LynxElement::try_from_js_value_ref(new_children)
            .unwrap()
            .dom_ref
            .as_ref()
            .unwrap()
            .clone()
            .into(),
        );
        arr
      } else {
        js_sys::Array::new()
      }
    };
    let old_children: Vec<LynxElement> = {
      // the old_children could be 1. array of LynxElement 2. single LynxElement
      if old_children.is_array() {
        let old_children_array: js_sys::Array =
          old_children.unchecked_ref::<js_sys::Array>().clone();
        old_children_array
          .iter()
          .map(|v| LynxElement::try_from_js_value(v).unwrap())
          .collect()
      } else if old_children.is_object() {
        vec![LynxElement::try_from_js_value_ref(old_children).unwrap()]
      } else {
        vec![]
      }
    };

    let parent_dom = parent.dom_ref.as_ref().unwrap();

    if old_children.is_empty() {
      // just append new children
      parent_dom.append_with_node(&new_children).unwrap();
    } else {
      let first_old_child_dom = old_children[0].dom_ref.as_ref().unwrap();
      for ii in 1..old_children.len() {
        self.remove_element(parent, &old_children[ii]);
      }
      first_old_child_dom
        .replace_with_with_node(&new_children)
        .unwrap();
    }
  }

  #[wasm_bindgen(js_name = __AddConfig)]
  pub fn add_config(&mut self, element: &LynxElement, type_: &str, value: &wasm_bindgen::JsValue) {
    let unique_id = element.data.borrow().unique_id;
    self
      .unique_id_to_config_map
      .entry(unique_id)
      .or_default()
      .insert(
        type_.to_string(),
        js_sys::JSON::stringify(value).unwrap().as_string().unwrap(),
      );
  }

  #[wasm_bindgen(js_name = __AddDataset)]
  pub fn add_dataset(&self, element: &LynxElement, key: &str, value: &wasm_bindgen::JsValue) {
    let dataset = &mut element.data.borrow_mut().dataset;
    let dom = element.dom_ref.as_ref().unwrap();
    if value.is_truthy() {
      // if the value is string, set it directly, otherwise convert it to string by using JSON.stringify
      let value = if let Some(s) = value.as_string() {
        s
      } else {
        js_sys::JSON::stringify(value).unwrap().as_string().unwrap()
      };
      // check if the value is different
      if dataset.get(key) != Some(&value) {
        dataset.insert(key.to_string(), value.clone().into());
        let _ = dom.set_attribute(key, &value);
      }
    } else {
      // remove the key
      dataset.remove(key);
      let _ = dom.remove_attribute(key);
    }
  }

  #[wasm_bindgen(js_name = __GetDataset)]
  pub fn get_dataset(&self, element: &LynxElement) -> wasm_bindgen::JsValue {
    let dataset = &element.data.borrow().dataset;
    serde_wasm_bindgen::to_value(dataset).unwrap()
  }

  // #[wasm_bindgen(js_name = __GetDataByKey)]
  // pub fn get_data_by_key(&self, element: &LynxElement, key: &str) -> wasm_bindgen::JsValue {
  //   let dom = element.dom_ref.as_ref().unwrap();
  //   let dataset = js_helpers::get_property(dom, "dataset").unwrap();
  //   js_helpers::get_property(&dataset, key).unwrap()
  // }

  // #[wasm_bindgen(js_name = __GetAttributes)]
  // pub fn get_attributes(&self, element: &LynxElement) -> Object {
  //   let dom = element.dom_ref.as_ref().unwrap();
  //   let attributes = dom.attributes();
  //   let result = Object::new();
  //   for i in 0..attributes.length() {
  //       let attr = attributes.item(i).unwrap();
  //       js_helpers::set_property(&result, &attr.name(), &attr.value().into()).unwrap();
  //   }
  //   result
  // }

  // #[wasm_bindgen(js_name = __GetComponentID)]
  // pub fn get_component_id(&self, element: &LynxElement) -> Option<String> {
  //   element.dom_ref.as_ref().unwrap().get_attribute(constants::COMPONENT_ID_ATTRIBUTE)
  // }

  // #[wasm_bindgen(js_name = __GetElementConfig)]
  // pub fn get_element_config(&self, _element: &LynxElement) -> Object {
  //   // TODO
  //   Object::new()
  // }

  // #[wasm_bindgen(js_name = __GetAttributeByName)]
  // pub fn get_attribute_by_name(&self, element: &LynxElement, name: &str) -> Option<String> {
  //   element.dom_ref.as_ref().unwrap().get_attribute(name)
  // }

  // #[wasm_bindgen(js_name = __GetID)]
  // pub fn get_id(&self, element: &LynxElement) -> Option<String> {
  //   element.dom_ref.as_ref().unwrap().get_attribute("id")
  // }

  // #[wasm_bindgen(js_name = __SetID)]
  // pub fn set_id(&self, element: &LynxElement, id: &str) {
  //   element.dom_ref.as_ref().unwrap().set_attribute("id", id).unwrap();
  // }

  // #[wasm_bindgen(js_name = __GetTag)]
  // pub fn get_tag(&self, element: &LynxElement) -> String {
  //   element.data.borrow().tag.clone()
  // }

  // #[wasm_bindgen(js_name = __SetConfig)]
  // pub fn set_config(&self, _element: &LynxElement, _config: &Object) {
  //   // TODO
  // }

  // #[wasm_bindgen(js_name = __SetDataset)]
  // pub fn set_dataset(&self, element: &LynxElement, dataset: &Object) {
  //   let dom = element.dom_ref.as_ref().unwrap();
  //   let dom_dataset = js_helpers::get_property(dom, "dataset").unwrap();
  //   let keys = Object::keys(dataset);
  //   for i in 0..keys.length() {
  //       let key: JsValue = keys.get(i);
  //       let value = js_helpers::get_property(dataset, &key.as_string().unwrap()).unwrap();
  //       js_helpers::set_property(&dom_dataset, &key.as_string().unwrap(), &value).unwrap();
  //   }
  // }

  // #[wasm_bindgen(js_name = __UpdateComponentID)]
  // pub fn update_component_id(&self, element: &LynxElement, component_id: &str) {
  //   element.dom_ref.as_ref().unwrap().set_attribute(constants::COMPONENT_ID_ATTRIBUTE, component_id).unwrap();
  // }

  // #[wasm_bindgen(js_name = __GetClasses)]
  // pub fn get_classes(&self, element: &LynxElement) -> Array {
  //   let class_list = element.dom_ref.as_ref().unwrap().class_list();
  //   let result = Array::new();
  //   for i in 0..class_list.length() {
  //       result.push(&class_list.item(i).unwrap().into());
  //   }
  //   result
  // }

  // #[wasm_bindgen(js_name = __UpdateComponentInfo)]
  // pub fn update_component_info(&self, _element: &LynxElement, _params: &Object) {
  //   // TODO
  // }

  // #[wasm_bindgen(js_name = __SetCSSId)]
  // pub fn set_css_id(&self, elements: &Array, css_id: &str, _entry_name: &str) {
  //     for element in elements.iter() {
  //         let element: LynxElement = element.into();
  //         element.dom_ref.as_ref().unwrap().set_attribute(constants::CSS_ID_ATTRIBUTE, css_id).unwrap();
  //     }
  // }

  // #[wasm_bindgen(js_name = __SetClasses)]
  // pub fn set_classes(&self, element: &LynxElement, classname: &str) {
  //   element.dom_ref.as_ref().unwrap().set_attribute("class", classname).unwrap();
  // }

  // #[wasm_bindgen(js_name = __AddInlineStyle)]
  // pub fn add_inline_style(&self, element: &LynxElement, key: &wasm_bindgen::JsValue, value: &wasm_bindgen::JsValue) {
  //   let style = js_helpers::get_property(element.dom_ref.as_ref().unwrap(), "style").unwrap();
  //   js_helpers::get_function(&style, "setProperty")
  //       .unwrap()
  //       .call2(&style, key, value)
  //       .unwrap();
  // }

  // #[wasm_bindgen(js_name = __AddClass)]
  // pub fn add_class(&self, element: &LynxElement, class_name: &str) {
  //   element.dom_ref.as_ref().unwrap().class_list().add_1(class_name).unwrap();
  // }

  // #[wasm_bindgen(js_name = __SetInlineStyles)]
  // pub fn set_inline_styles(&self, element: &LynxElement, value: &wasm_bindgen::JsValue) {
  //     let style = js_helpers::get_property(element.dom_ref.as_ref().unwrap(), "style").unwrap();
  //     js_helpers::set_property(&style, "cssText", value).unwrap();
  // }

  // #[wasm_bindgen(js_name = __GetTemplateParts)]
  // pub fn get_template_parts(&self, _template_element: &LynxElement) -> Object {
  //   // TODO
  //   Object::new()
  // }

  // #[wasm_bindgen(js_name = "__MarkPartElement")]
  // pub fn mark_part_element(&self, element: &LynxElement, part_id: &str) {
  //   element.dom_ref.as_ref().unwrap().set_attribute("part", part_id).unwrap();
  // }

  // #[wasm_bindgen(js_name = "__GetElementByUniqueId")]
  // pub fn get_element_by_unique_id(&self, unique_id: i32) -> Option<wasm_bindgen::JsValue> {
  //   let query = format!("[data-lynx-unique-id='{}']", unique_id);
  //   self.root_node.query_selector(&query).unwrap()
  // }

  // #[wasm_bindgen(js_name = "__FlushElementTree")]
  //   let timing_flags = js_sys::Array::from_iter(self.timing_flags.iter().map(JsValue::from));

  //   self.timing_flags.clear();
  //   self.exposure_changed_elements.clear();
  // }

  #[wasm_bindgen(js_name = "__wasm_GC")]
  pub fn gc(&mut self) {
    self.unique_id_to_element_data_map.retain(|_, value| {
      value.dom_ref.is_some()
        && Rc::strong_count(&value.data) == 1
        && value.dom_ref.as_ref().unwrap().is_connected()
    });
  }
}

/**
 * methods for internal use
 */
impl MainThreadGlobalThis {
  pub(crate) fn create_element_impl(
    &mut self,
    tag: &str,
    parent_component_unique_id: i32,
    override_css_id: Option<i32>,
  ) -> LynxElement {
    self.unique_id_counter += 1;
    let unique_id = self.unique_id_counter;
    let tag = tag.to_string();
    let html_tag = self.tag_name_to_html_tag_map.get(&tag);
    let html_tag_string = if let Some(html_tag) = html_tag {
      html_tag.clone()
    } else {
      tag
    };
    let parent_component_data = self
      .unique_id_to_element_data_map
      .get(&parent_component_unique_id);
    let element = self.document.create_element(&html_tag_string).unwrap();
    let css_id = {
      if let Some(override_css_id) = override_css_id {
        override_css_id
      } else if let Some(parent_component_data) = parent_component_data {
        parent_component_data.data.borrow().css_id
      } else {
        0
      }
    };
    let element = Box::new(LynxElement::new(
      unique_id,
      css_id,
      html_tag_string,
      parent_component_unique_id,
      element,
    ));
    let cloned_element = (*element).clone();
    self
      .unique_id_to_element_data_map
      .insert(unique_id, element);
    cloned_element
  }

  pub(crate) fn get_lynx_element_by_dom(
    &self,
    dom: &web_sys::Element,
  ) -> Option<&Box<LynxElement>> {
    let unique_id_str = dom
      .get_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE)
      .unwrap_or("0".to_string());
    let unique_id = unique_id_str.parse::<i32>().unwrap_or(0);
    if let Some(element) = self.unique_id_to_element_data_map.get(&unique_id) {
      Some(element)
    } else {
      None
    }
  }
}
