use super::{LynxElement, MainThreadGlobalThis};
use crate::constants;
use crate::template::{ElementTemplate, TemplateManager};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

pub(crate) struct ElementTemplatesInstance {
  template_element: web_sys::HtmlTemplateElement,
  lynx_elements: HashMap<i32, LynxElement>,
}

impl ElementTemplatesInstance {
  fn create_element_for_current_template(
    element_template: &ElementTemplate,
    mts_global_this: &MainThreadGlobalThis,
    lynx_elements: &mut HashMap<i32, LynxElement>,
  ) -> web_sys::HtmlElement {
    let dummy_id = -1 - lynx_elements.len() as i32;
    let element = LynxElement::create_dummy_element(
      mts_global_this,
      element_template.type_name.as_str(),
      dummy_id,
    );
    element.set_id(element_template.id_selector.clone());
    if let Some(class_list) = &element_template.class {
      for class_name in class_list {
        element.get_dom().class_list().add_1(class_name).unwrap();
      }
    }
    if let Some(attributes) = &element_template.attributes {
      for (attr_name, attr_value) in attributes {
        if attr_name == "part" {
          element.mark_part(Some(attr_value));
          continue;
        }
        let _ = element.get_dom().set_attribute(attr_name, attr_value);
      }
    }
    if let Some(built_in_attributes) = &element_template.built_in_attributes {
      for (attr_name, attr_value) in built_in_attributes {
        if attr_name == "part" {
          element.mark_part(Some(attr_value));
          continue;
        }
        let _ = element.get_dom().set_attribute(attr_name, attr_value);
      }
    }
    if let Some(dataset) = &element_template.dataset {
      element.set_dataset_by_string_map(dataset);
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

  fn new(
    lynx_element_api_templates: &[ElementTemplate],
    mts_global_this: &MainThreadGlobalThis,
  ) -> Self {
    let template_element: web_sys::HtmlTemplateElement = mts_global_this
      .document
      .create_element("template")
      .unwrap()
      .unchecked_into::<web_sys::HtmlTemplateElement>();
    let template_content = template_element.content();
    let mut lynx_elements: HashMap<i32, LynxElement> = HashMap::new();
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
      lynx_elements,
    }
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
  #[wasm_bindgen(js_name = "__MarkTemplateElement")]
  pub fn mark_template_element(&mut self, element: &LynxElement) {
    element.mark_template();
  }

  #[wasm_bindgen(js_name = "__MarkPartElement")]
  pub fn mark_part_element(&self, element: &mut LynxElement, part_id: Option<String>) {
    element.mark_part(part_id.as_deref());
  }

  #[wasm_bindgen(js_name = "__GetTemplateParts")]
  pub fn get_template_parts(&self, element: &LynxElement) -> js_sys::Object {
    // check if the element is marked as template
    let dom = element.get_dom();
    let is_template = dom
      .get_attribute(constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE)
      .is_some();
    let mut part_id_to_element_map: HashMap<String, LynxElement> = HashMap::new();
    if is_template {
      let unique_id = element.get_unique_id();
      let part_elements_node_list = dom
        .query_selector_all(&format!(
          "[{}]:not([{}=\"{}\"] [{}] [{}])",
          constants::LYNX_PART_ID_ATTRIBUTE,
          constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE,
          unique_id,
          constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE,
          constants::LYNX_PART_ID_ATTRIBUTE
        ))
        .unwrap();
      for i in 0..part_elements_node_list.length() {
        let part_element_node: web_sys::HtmlElement =
          part_elements_node_list.item(i).unwrap().dyn_into().unwrap();
        let part_element = self.get_lynx_element_by_dom(&part_element_node).unwrap();
        let part_id = part_element.get_part_id();
        part_id_to_element_map.insert(part_id, part_element.clone());
      }
    }
    js_sys::Object::from_entries(
      &part_id_to_element_map
        .into_iter()
        .map(|(k, v)| {
          let key = wasm_bindgen::JsValue::from_str(&k);
          let value = wasm_bindgen::JsValue::from(v);
          js_sys::Array::of2(&key, &value)
        })
        .collect::<js_sys::Array>(),
    )
    .unwrap()
  }

  #[wasm_bindgen(js_name = "__wasm_binding__ElementFromBinary")]
  pub fn element_from_binary(
    &mut self,
    template_manager: &TemplateManager,
    template_id: String,
    parent_component_unique_id: i32,
  ) -> Vec<LynxElement> {
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
          let mut result_elements: Vec<LynxElement> = vec![];
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
