use super::MainThreadGlobalThis;
use crate::constants;
use crate::main_thread::element_apis::LynxElementData;
use crate::template::{ElementTemplate, TemplateManager};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

pub(crate) struct ElementTemplatesInstance {
  template_element: web_sys::HtmlTemplateElement,
  lynx_elements_data: HashMap<i32, LynxElementData>,
}

impl ElementTemplatesInstance {
  fn new(lynx_element_api_templates: &[ElementTemplate]) -> Self {
    let template_element: web_sys::HtmlTemplateElement = mts_global_this
      .document
      .create_element("template")
      .unwrap()
      .unchecked_into::<web_sys::HtmlTemplateElement>();
    let template_content = template_element.content();
    let mut lynx_elements_data: HashMap<i32, LynxElementData> = HashMap::new();
    for template in lynx_element_api_templates {
      let dom =
        Self::create_element_for_current_template(template, mts_global_this, &mut lynx_elements);
      template_content.append_child(&dom).unwrap();
    }
    mts_global_this
      .root_node
      .append_child(&template_element)
      .unwrap();
    Self {
      template_element,
      lynx_elements_data,
    }
  }
  fn create_element_for_current_template(
    &mut self,
    element_template: &ElementTemplate,
    element_tag_to_html_tag_map: Option<&HashMap<String, String>>,
  ) -> web_sys::HtmlElement {
    let dummy_id = -1 - self.lynx_elements_data.len() as i32;
    let dom = web_sys::window()
      .unwrap()
      .document()
      .unwrap()
      .create_element(
        element_tag_to_html_tag_map
          .and_then(|map| map.get(&element_template.type_name))
          .map(|s| s.as_str())
          .unwrap_or(&element_template.type_name),
      )
      .unwrap()
      .unchecked_into::<web_sys::HtmlElement>();
    let element_data = LynxElementData::new(dom.clone());
    if let Some(class_list) = &element_template.class {
      for class_name in class_list {
        dom.class_list().add_1(class_name).unwrap();
      }
    }
    if let Some(attributes) = &element_template.attributes {
      for (attr_name, attr_value) in attributes {
        if attr_name == "part" {
          let _ = dom.set_attribute(constants::LYNX_PART_ID_ATTRIBUTE, attr_value);
        } else {
          let _ = dom.set_attribute(attr_name, attr_value);
        }
      }
    }
    if let Some(built_in_attributes) = &element_template.built_in_attributes {
      for (attr_name, attr_value) in built_in_attributes {
        if attr_name == "part" {
          let _ = dom.set_attribute(constants::LYNX_PART_ID_ATTRIBUTE, attr_value);
        } else {
          let _ = dom.set_attribute(attr_name, attr_value);
        }
      }
    }
    if let Some(dataset) = &element_template.dataset {
      let dataset_obj = js_sys::Object::from_entries(
        &dataset
          .iter()
          .map(|(k, v)| {
            let key = wasm_bindgen::JsValue::from_str(k);
            let value = wasm_bindgen::JsValue::from_str(v);
            js_sys::Array::of2(&key, &value)
          })
          .collect::<js_sys::Array>(),
      )
      .unwrap();
      element_data.dataset = Some(dataset_obj);
    }
    if let Some(events) = &element_template.events {
      for event_registration in events {
        element.replace_framework_cross_thread_event_handler(
          event_registration.event_name.clone(),
          event_registration.event_type.clone(),
          Some(event_registration.event_value.clone()),
        );
      }
    }
    if let Some(children) = &element_template.children {
      for child_template in children {
        let child_element =
          Self::create_element_for_current_template(child_template, mts_global_this, lynx_elements);
        element.get_dom().append_child(&child_element).unwrap();
      }
    }
    let dom = element.get_dom();
    lynx_elements.insert(dummy_id, element);
    dom
  }

  /**
   * key: dummy_id, value: cloned HtmlElement
   */
  fn clone_dom(
    &self,
  ) -> (
    HashMap<i32, web_sys::HtmlElement>,
    web_sys::DocumentFragment,
  ) {
    let template_content: web_sys::DocumentFragment = self
      .template_element
      .content()
      .clone_node_with_deep(true)
      .unwrap()
      .unchecked_into();
    let elements = template_content.query_selector_all("*").unwrap();
    let mut dummy_id_to_cloned_element_map: HashMap<i32, web_sys::HtmlElement> = HashMap::new();
    for i in 0..elements.length() {
      let element: web_sys::HtmlElement = elements.item(i).unwrap().unchecked_into();
      let dummy_id = js_sys::Reflect::get(
        &element,
        &wasm_bindgen::JsValue::from_str(constants::LYNX_UNIQUE_ID_ATTRIBUTE),
      )
      .unwrap()
      .as_f64()
      .unwrap() as i32;
      dummy_id_to_cloned_element_map.insert(dummy_id, element);
    }
    (dummy_id_to_cloned_element_map, template_content)
  }
}

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__wasm__ElementFromBinary")]
  pub fn element_from_binary(
    &mut self,
    template_manager: &TemplateManager,
    template_id: String,
    parent_component_unique_id: usize,
  ) -> Vec<web_sys::HtmlElement> {
    if let Some(template_url) = &self.entry_template_url {
      if let Some(cached_template) = template_manager.get_cached_template(template_url) {
        if let Some(element_templates) = cached_template.get_element_templates_by_id(&template_id) {
          let instance = if let Some(instance) = self.element_templates_instances.get(&template_id)
          {
            instance
          } else {
            let new_instance = ElementTemplatesInstance::new(element_templates, self);
            self
              .element_templates_instances
              .insert(template_id.clone(), new_instance);
            self.element_templates_instances.get(&template_id).unwrap()
          };
          let (cloned_dom_map, template_content) = instance.clone_dom();
          for (dummy_id, cloned_dom) in cloned_dom_map {
            let unique_id = self.unique_id_counter + 1;
            self.unique_id_counter = unique_id;
            // unique id, same logic as LynxElement::new
            self.unique_id_counter += 1;
            let unique_id = self.unique_id_counter;
            if !self.config_enable_css_selector {
              let _ = cloned_dom
                .set_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE, &unique_id.to_string());
            }
            let lynx_element = instance
              .lynx_elements
              .get(&dummy_id)
              .unwrap()
              .clone_with_new_dom(self, cloned_dom, parent_component_unique_id, unique_id);
            self
              .unique_id_to_element_map
              .insert(unique_id, Box::new(lynx_element.clone()));
          }
          let mut result_elements: Vec<web_sys::HtmlElement> = vec![];
          let children = template_content.children();
          for i in 0..children.length() {
            if let Some(child) = children.item(i) {
              if let Some(e) = self.get_lynx_element_by_dom(&child.unchecked_into()) {
                result_elements.push(e.clone());
              }
            }
          }
          return result_elements;
        }
      }
    }

    vec![]
  }
}
