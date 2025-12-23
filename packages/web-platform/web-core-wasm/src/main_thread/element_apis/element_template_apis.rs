/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::LynxElementData;
use crate::constants;
use crate::leo_asm::LEOAsmOpcode;
use crate::main_thread::main_thread_context::MainThreadWasmContext;
use crate::template::template_sections::element_template::ElementTemplateSection;
use fnv::{FnvHashMap, FnvHashSet};
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
pub(crate) struct DecodedElementTemplate {
  id_to_prepared_element_data: FnvHashMap<i32, LynxElementData>,
  template_root_dom: web_sys::HtmlTemplateElement,
  timing_flags: Vec<String>,
  exposure_changed_elements: FnvHashSet<i32>,
}

#[wasm_bindgen]
impl MainThreadWasmContext {
  #[wasm_bindgen(js_name = _wasm_elementFromBinary)]
  pub fn element_from_binary(
    &mut self,
    parent_component_unique_id: usize,
    template_url: String,
    element_template_name: String,
    element_template_section: &ElementTemplateSection,
  ) -> Result<web_sys::Element, JsError> {
    if let Some(decoded_element_template) = self
      .element_templates_instances
      .get(&template_url)
      .and_then(|map| map.get(&element_template_name))
    {
      let cloned_root = decoded_element_template
        .template_root_dom
        .content()
        .clone_node_with_deep(true)
        .unwrap()
        .unchecked_into::<web_sys::DocumentFragment>();
      let elements = cloned_root
        .query_selector_all(format!("[{}]", constants::LYNX_TEMPLATE_MEMBER_ID_ATTRIBUTE).as_str())
        .unwrap();
      for element in elements.values() {
        let dom = element.unwrap().unchecked_into::<web_sys::HtmlElement>();
        let unique_id_attr = dom
          .get_attribute(constants::LYNX_TEMPLATE_MEMBER_ID_ATTRIBUTE)
          .ok_or_else(|| JsError::new("Missing LYNX_TEMPLATE_MEMBER_ID_ATTRIBUTE"))?;
        let element_id: i32 = unique_id_attr
          .parse()
          .map_err(|e| JsError::new(&format!("Failed to parse element_id: {e}")))?;
        if let Some(prepared_element_data) = decoded_element_template
          .id_to_prepared_element_data
          .get(&element_id)
        {
          let css_id = if let Some(parent_component_data) =
            self.get_element_data_by_unique_id(parent_component_unique_id)
          {
            parent_component_data.borrow().css_id
          } else {
            0
          };
          let unique_id = self.unique_id_to_element_map.len();
          if !self.config_enable_css_selector {
            let _ = dom.set_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE, &unique_id.to_string());
          }

          if css_id != 0 {
            let _ = dom.set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
          }
          js_sys::Reflect::set(
            &dom,
            &self.unique_id_symbol,
            &JsValue::from_f64(unique_id as f64),
          )
          .unwrap();
          let lynx_element_data =
            prepared_element_data.clone_node(parent_component_unique_id, css_id);

          if decoded_element_template
            .exposure_changed_elements
            .contains(&element_id)
          {
            self.mts_binding.mark_exposure_related_element_by_unique_id(
              unique_id,
              lynx_element_data.should_enable_exposure_event(),
            );
          }
          if !decoded_element_template.timing_flags.is_empty() {
            self
              .timing_flags
              .extend(decoded_element_template.timing_flags.iter().cloned());
          }
          self
            .unique_id_to_element_map
            .push(Some(Rc::new(RefCell::new(Box::new(lynx_element_data)))));
        }
      }
      Ok(
        cloned_root
          .first_child()
          .ok_or_else(|| JsError::new("Template content is empty"))?
          .unchecked_into::<web_sys::Element>(),
      )
    } else {
      // create from raw template
      let raw_element_template = element_template_section
        .element_templates_map
        .get(&element_template_name)
        .ok_or_else(|| {
          JsError::new(&format!(
            "Element template {element_template_name} not found in template {template_url}",
          ))
        })?;
      // invoke element_load handler
      for tag_name in raw_element_template.tag_names.iter() {
        if let Some(id) = constants::LYNX_TAG_TO_DYNAMIC_LOAD_TAG_ID.get(tag_name.as_str()) {
          self.mts_binding.load_internal_web_element(*id);
        } else if !constants::ALREADY_LOADED_TAGS.contains(tag_name.as_str()) {
          self.mts_binding.load_unknown_element(tag_name.as_str());
        }
      }
      let template_root_dom = self
        .document
        .create_element("template")
        .unwrap()
        .unchecked_into::<web_sys::HtmlTemplateElement>();
      let template_root_content = template_root_dom.content();
      let mut id_to_prepared_element_data: FnvHashMap<i32, LynxElementData> = FnvHashMap::default();
      let mut id_to_html_element: FnvHashMap<i32, web_sys::HtmlElement> = FnvHashMap::default();
      let mut timing_flags: Vec<String> = Vec::new();
      let mut exposure_changed_elements: FnvHashSet<i32> = FnvHashSet::default();
      for operation in raw_element_template.operations.iter() {
        match operation.opcode {
          LEOAsmOpcode::CreateElement => {
            let tag_name = &operation.operands_str[0];
            let dom = self
              .document
              .create_element(
                constants::LYNX_TAG_TO_HTML_TAG_MAP
                  .get(tag_name.as_str())
                  .copied()
                  .unwrap_or(tag_name),
              )
              .map_err(|e| JsError::new(&format!("Failed to create element {tag_name}: {e:?}")))?;
            let element_id = operation.operands_num[0];
            // reuse the unique id attribute
            let _ = dom.set_attribute(
              constants::LYNX_TEMPLATE_MEMBER_ID_ATTRIBUTE,
              &element_id.to_string(),
            );
            id_to_html_element.insert(element_id, dom.unchecked_into::<web_sys::HtmlElement>());
            id_to_prepared_element_data.insert(
              element_id,
              LynxElementData::new(parent_component_unique_id, 0, None),
            );
          }
          LEOAsmOpcode::SetAttribute => {
            let element_id = operation.operands_num[0];
            let attr_name = &operation.operands_str[0];
            let attr_value = &operation.operands_str[1];
            let dom = &id_to_html_element
              .get(&element_id)
              .ok_or_else(|| JsError::new(&format!("Element {element_id} not found")))?;
            let _ = dom.set_attribute(attr_name, attr_value);
            match attr_name.as_str() {
              constants::LYNX_EXPOSURE_ID_ATTRIBUTE => {
                exposure_changed_elements.insert(element_id);
              }
              constants::LYNX_TIMING_FLAG_ATTRIBUTE => {
                timing_flags.push(attr_value.clone());
              }
              _ => {}
            }
          }
          LEOAsmOpcode::AppendToRoot => {
            let element_id = operation.operands_num[0];
            let dom = &id_to_html_element
              .get(&element_id)
              .ok_or_else(|| JsError::new(&format!("Element {element_id} not found")))?;
            template_root_content
              .append_child(dom)
              .map_err(|e| JsError::new(&format!("Failed to append child to root: {e:?}")))?;
          }
          LEOAsmOpcode::AddEvent => {
            let element_id = operation.operands_num[0];
            let element_data = id_to_prepared_element_data
              .get_mut(&element_id)
              .ok_or_else(|| JsError::new(&format!("Element {element_id} not found")))?;
            let [event_type, event_name] = &operation.operands_str[..2] else {
              return Err(JsError::new("Invalid operands for AddEvent opcode"));
            };
            let identifier = &operation.operands_str.get(2);
            let event_name = event_name.to_ascii_lowercase();
            let event_type = event_type.to_ascii_lowercase();
            self.enable_event(&event_name);
            match event_name.as_str() {
              constants::APPEAR_EVENT_NAME | constants::DISAPPEAR_EVENT_NAME => {
                exposure_changed_elements.insert(element_id);
              }
              _ => {}
            }
            element_data.replace_framework_cross_thread_event_handler(
              event_name,
              event_type,
              identifier.cloned(),
            );
          }
          LEOAsmOpcode::AppendChild => {
            let parent_element_id = operation.operands_num[0];
            let child_element_id = operation.operands_num[1];
            let parent_dom = &id_to_html_element.get(&parent_element_id).ok_or_else(|| {
              JsError::new(&format!("Parent element {parent_element_id} not found"))
            })?;
            let child_dom = &id_to_html_element.get(&child_element_id).ok_or_else(|| {
              JsError::new(&format!("Child element {child_element_id} not found"))
            })?;
            parent_dom
              .append_child(child_dom)
              .map_err(|e| JsError::new(&format!("Failed to append child: {e:?}")))?;
          }
          LEOAsmOpcode::SetDataset => {
            let element_id = operation.operands_num[0];
            let data_name = &operation.operands_str[0];
            let data_value = &operation.operands_str[1];
            let element_data = id_to_prepared_element_data
              .get_mut(&element_id)
              .ok_or_else(|| JsError::new(&format!("Element {element_id} not found")))?;
            let dataset = element_data.dataset.get_or_insert_default();
            let _ = js_sys::Reflect::set(
              dataset,
              &JsValue::from_str(data_name),
              &JsValue::from_str(data_value),
            );
            let dom = &id_to_html_element
              .get(&element_id)
              .ok_or_else(|| JsError::new(&format!("Element {element_id} not found")))?;
            let _ = dom.set_attribute(data_name, data_value);
          }
          _ => {
            return Err(JsError::new(
              "Unsupported opcode in element template decoding",
            ));
          }
        }
      }

      let _ = self.root_node.append_child(&template_root_dom);

      self
        .element_templates_instances
        .entry(template_url.clone())
        .or_default()
        .insert(
          element_template_name.clone(),
          Box::new(DecodedElementTemplate {
            template_root_dom,
            id_to_prepared_element_data,
            timing_flags,
            exposure_changed_elements,
          }),
        );
      self.element_from_binary(
        parent_component_unique_id,
        template_url,
        element_template_name,
        element_template_section,
      )
    }
  }
}
