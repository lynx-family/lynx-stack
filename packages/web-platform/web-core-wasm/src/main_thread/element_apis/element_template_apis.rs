/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::LynxElementData;
use crate::constants;
use crate::leo_asm::LEOAsmOpcode;
use crate::main_thread::main_thread_context::MainThreadWasmContext;
use crate::template::template_manager::TemplateManager;
use fnv::FnvHashMap;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
pub(crate) struct DecodedElementTemplate {
  id_to_prepared_element_data: FnvHashMap<i32, LynxElementData>,
  template_root_dom: web_sys::HtmlTemplateElement,
}

#[wasm_bindgen]
impl MainThreadWasmContext {
  #[wasm_bindgen(js_name = _wasm_elementFromBinary)]
  pub fn element_from_binary(
    &mut self,
    parent_component_unique_id: usize,
    template_url: String,
    element_template_name: String,
    template_manager: &TemplateManager,
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
        let dom = element.unwrap().unchecked_into::<web_sys::Element>();
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
          let lynx_element_data = LynxElementData {
            parent_component_unique_id,
            css_id,
            dom_ref: dom.clone().unchecked_into::<web_sys::HtmlElement>(),
            dataset: prepared_element_data
              .dataset
              .as_ref()
              .map(|dataset| js_sys::Object::assign(&js_sys::Object::default(), dataset)),
            component_config: prepared_element_data.component_config.as_ref().map(
              |component_config| {
                js_sys::Object::assign(&js_sys::Object::default(), component_config)
              },
            ),
            component_id: prepared_element_data.component_id.clone(),
            event_handlers_map: prepared_element_data.event_handlers_map.clone(),
          };
          let unique_id = self.unique_id_to_element_map.len();
          if !self.config_enable_css_selector {
            let _ = dom.set_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE, &unique_id.to_string());
          }

          if css_id != 0 {
            let _ = dom.set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
          }
          self
            .unique_id_to_element_map
            .push(Some(Rc::new(RefCell::new(Box::new(lynx_element_data)))));
          js_sys::Reflect::set(
            &dom,
            &self.unique_id_symbol,
            &JsValue::from_f64(unique_id as f64),
          )
          .unwrap();
        }
      }
      Ok(
        cloned_root
          .first_child()
          .ok_or_else(|| JsError::new("Template content is empty"))?
          .unchecked_into::<web_sys::Element>(),
      )
    } else {
      let raw_element_template = template_manager
        .get_raw_template_element(&template_url, &element_template_name)
        .map_err(JsError::new)?;
      let document = web_sys::window().unwrap().document().unwrap();
      let template_root_dom = document
        .create_element("template")
        .unwrap()
        .unchecked_into::<web_sys::HtmlTemplateElement>();
      let template_root_content = template_root_dom.content();
      let mut id_to_prepared_element_data: FnvHashMap<i32, LynxElementData> = FnvHashMap::default();
      for operation in raw_element_template.operations.iter() {
        match operation.opcode {
          LEOAsmOpcode::CreateElement => {
            let tag_name = &operation.operands_str[0];
            let dom = document
              .create_element(
                self
                  .tag_name_to_html_tag_map
                  .get(tag_name)
                  .map(|s| s.as_str())
                  .unwrap_or(tag_name),
              )
              .map_err(|e| JsError::new(&format!("Failed to create element {tag_name}: {e:?}")))?;
            let element_id = operation.operands_num[0];
            let _ = dom.set_attribute(constants::LYNX_TAG_ATTRIBUTE, tag_name);
            // reuse the unique id attribute
            let _ = dom.set_attribute(
              constants::LYNX_TEMPLATE_MEMBER_ID_ATTRIBUTE,
              &element_id.to_string(),
            );
            id_to_prepared_element_data.insert(
              element_id,
              LynxElementData {
                parent_component_unique_id: 0, // placeholder
                css_id: 0,                     // placeholder
                dom_ref: dom.unchecked_into::<web_sys::HtmlElement>(),
                dataset: None,
                component_config: None,
                component_id: None,
                event_handlers_map: None,
              },
            );
          }
          LEOAsmOpcode::SetAttribute => {
            let element_id = operation.operands_num[0];
            let attr_name = &operation.operands_str[0];
            let attr_value = &operation.operands_str[1];
            let dom = &id_to_prepared_element_data
              .get(&element_id)
              .ok_or_else(|| JsError::new(&format!("Element {element_id} not found")))?
              .dom_ref;
            let _ = dom.set_attribute(attr_name, attr_value);
          }
          LEOAsmOpcode::AppendToRoot => {
            let element_id = operation.operands_num[0];
            let dom = &id_to_prepared_element_data
              .get(&element_id)
              .ok_or_else(|| JsError::new(&format!("Element {element_id} not found")))?
              .dom_ref;
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
            element_data.replace_framework_cross_thread_event_handler(
              event_name,
              event_type,
              identifier.cloned(),
            );
            self.enable_event(event_name);
          }
          LEOAsmOpcode::AppendChild => {
            let parent_element_id = operation.operands_num[0];
            let child_element_id = operation.operands_num[1];
            let parent_dom = &id_to_prepared_element_data
              .get(&parent_element_id)
              .ok_or_else(|| {
                JsError::new(&format!("Parent element {parent_element_id} not found"))
              })?
              .dom_ref;
            let child_dom = &id_to_prepared_element_data
              .get(&child_element_id)
              .ok_or_else(|| JsError::new(&format!("Child element {child_element_id} not found")))?
              .dom_ref;
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
            let _ = element_data.dom_ref.set_attribute(data_name, data_value);
          }
          _ => {
            return Err(JsError::new(
              "Unsupported opcode in element template decoding",
            ));
          }
        }
      }

      self
        .root_node
        .append_child(&template_root_dom)
        .map_err(|e| JsError::new(&format!("Failed to append template root: {e:?}")))?;

      self
        .element_templates_instances
        .entry(template_url.clone())
        .or_default()
        .insert(
          element_template_name.clone(),
          Box::new(DecodedElementTemplate {
            template_root_dom,
            id_to_prepared_element_data,
          }),
        );
      self.element_from_binary(
        parent_component_unique_id,
        template_url,
        element_template_name,
        template_manager,
      )
    }
  }
}
