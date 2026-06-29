/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::main_thread_context::MainThreadWasmContext;
use crate::constants;
use crate::style_transformer::token_transformer::TransformerConfig;
use crate::style_transformer::{
  transform_inline_style_key_value_vec, transform_inline_style_string,
};
use fnv::{FnvHashMap, FnvHashSet};
use js_sys::{Array, Object, Reflect, WeakRef};
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{Document, DocumentFragment, HtmlElement, HtmlTemplateElement, Node};

const MAIN_BUNDLE_URL_SENTINEL: &str = "__Card__";
const SLOT_ANCHOR_PREFIX: &str = "lynx-et-slot:";

pub(crate) struct TemplateAttributeBinding {
  element_index: usize,
  slot_index: usize,
  key: String,
}

pub(crate) struct TemplateSpreadBinding {
  element_index: usize,
  slot_index: usize,
}

pub(crate) struct TemplateStaticBinding {
  element_index: usize,
  key: String,
  value: JsValue,
}

pub(crate) struct ElementTemplateDefinition {
  template_key: String,
  bundle_url: Option<String>,
  template: HtmlTemplateElement,
  attribute_bindings: Vec<TemplateAttributeBinding>,
  spread_bindings: Vec<TemplateSpreadBinding>,
  static_bindings: Vec<TemplateStaticBinding>,
}

#[wasm_bindgen]
pub struct ElementTemplateDefinitionBuilder {
  definition: ElementTemplateDefinition,
  document: Document,
  elements: Vec<HtmlElement>,
  root_added: bool,
  config_transform_vw: bool,
  config_transform_vh: bool,
  config_transform_rem: bool,
}

pub(crate) struct InstanceAttributeBinding {
  target_unique_id: usize,
  slot_index: usize,
  key: String,
}

pub(crate) struct InstanceSpreadBinding {
  target_unique_id: usize,
  slot_index: usize,
}

pub(crate) struct InstanceStaticBinding {
  target_unique_id: usize,
  key: String,
  value: JsValue,
}

pub(crate) enum ElementTemplateInstanceKind {
  Compiled {
    template_key: String,
    bundle_url: Option<String>,
  },
  Typed {
    tag: String,
  },
}

pub(crate) struct ElementTemplateInstance {
  handle_id: JsValue,
  kind: ElementTemplateInstanceKind,
  attribute_slots: Vec<JsValue>,
  attribute_bindings: Vec<InstanceAttributeBinding>,
  spread_bindings: Vec<InstanceSpreadBinding>,
  static_bindings: Vec<InstanceStaticBinding>,
  spread_keys: FnvHashMap<(usize, usize), Vec<String>>,
  slot_anchors: FnvHashMap<usize, Node>,
  element_slots: FnvHashMap<usize, Vec<usize>>,
  typed_attributes: Option<JsValue>,
  options: Option<JsValue>,
}

impl ElementTemplateDefinitionBuilder {
  fn create_element(&mut self, tag: &str) -> Result<(usize, HtmlElement), JsError> {
    let element = self
      .document
      .create_element(MainThreadWasmContext::map_lynx_tag_to_html_tag(tag))
      .map_err(|e| JsError::new(&format!("Failed to create element: {e:?}")))?
      .unchecked_into::<HtmlElement>();
    let element_index = self.elements.len();
    self.elements.push(element.clone());
    Ok((element_index, element))
  }

  fn element_by_index(&self, element_index: usize) -> Result<HtmlElement, JsError> {
    self
      .elements
      .get(element_index)
      .cloned()
      .ok_or_else(|| JsError::new("Element template builder target not found"))
  }
}

#[wasm_bindgen]
impl ElementTemplateDefinitionBuilder {
  pub fn append_root(&mut self, tag: String) -> Result<usize, JsError> {
    if self.root_added {
      return Err(JsError::new(
        "Element template definition already has a root",
      ));
    }

    let (element_index, element) = self.create_element(&tag)?;
    self
      .definition
      .template
      .content()
      .append_child(&element)
      .map_err(|e| JsError::new(&format!("Failed to append template root: {e:?}")))?;
    self.root_added = true;
    Ok(element_index)
  }

  pub fn append_child(&mut self, parent_index: usize, tag: String) -> Result<usize, JsError> {
    let parent = self.element_by_index(parent_index)?;
    let (element_index, element) = self.create_element(&tag)?;
    parent
      .append_child(&element)
      .map_err(|e| JsError::new(&format!("Failed to append child: {e:?}")))?;
    Ok(element_index)
  }

  pub fn append_slot(&self, parent_index: usize, slot_index: usize) -> Result<(), JsError> {
    let parent = self.element_by_index(parent_index)?;
    let anchor = self
      .document
      .create_comment(&format!("{SLOT_ANCHOR_PREFIX}{slot_index}"));
    parent
      .append_child(&anchor)
      .map_err(|e| JsError::new(&format!("Failed to append slot anchor: {e:?}")))?;
    Ok(())
  }

  pub fn push_static_attribute(
    &mut self,
    element_index: usize,
    key: String,
    value: JsValue,
  ) -> Result<(), JsError> {
    let element = self.element_by_index(element_index)?;
    let normalized_key = match key.as_str() {
      "css-id" => constants::CSS_ID_ATTRIBUTE,
      "className" => "class",
      _ => &key,
    };

    if normalized_key == "style" {
      MainThreadWasmContext::set_style_attribute(
        &element,
        &value,
        self.config_transform_vw,
        self.config_transform_vh,
        self.config_transform_rem,
      );
    } else if MainThreadWasmContext::value_is_nullish(&value) {
      let _ = element.remove_attribute(normalized_key);
    } else {
      element
        .set_attribute(
          normalized_key,
          &MainThreadWasmContext::value_to_string(&value),
        )
        .map_err(|e| JsError::new(&format!("Failed to set attribute: {e:?}")))?;
      if normalized_key == "text" {
        match element.tag_name().to_ascii_lowercase().as_str() {
          "x-text" | "raw-text" => {
            let mut child = element.first_child();
            while let Some(current) = child {
              child = current.next_sibling();
              if current.node_type() == Node::TEXT_NODE {
                let _ = element.remove_child(&current);
              }
            }
          }
          _ => {}
        }
      }
    }

    self.definition.static_bindings.push(TemplateStaticBinding {
      element_index,
      key,
      value,
    });
    Ok(())
  }

  pub fn push_slot_attribute(&mut self, element_index: usize, key: String, slot_index: usize) {
    self
      .definition
      .attribute_bindings
      .push(TemplateAttributeBinding {
        element_index,
        slot_index,
        key,
      });
  }

  pub fn push_spread_attribute(&mut self, element_index: usize, slot_index: usize) {
    self.definition.spread_bindings.push(TemplateSpreadBinding {
      element_index,
      slot_index,
    });
  }
}

impl MainThreadWasmContext {
  fn template_identity_key(template_key: &str, bundle_url: Option<&str>) -> String {
    match bundle_url {
      Some(url) if !url.is_empty() && url != MAIN_BUNDLE_URL_SENTINEL => {
        format!("{url}:{template_key}")
      }
      _ => template_key.to_string(),
    }
  }

  fn map_lynx_tag_to_html_tag(tag: &str) -> &str {
    constants::LYNX_TAG_TO_HTML_TAG_MAP
      .get(tag)
      .copied()
      .unwrap_or(tag)
  }

  fn value_to_string(value: &JsValue) -> String {
    if let Some(value) = value.as_string() {
      value
    } else if let Some(value) = value.as_f64() {
      value.to_string()
    } else if let Some(value) = value.as_bool() {
      value.to_string()
    } else {
      "[object Object]".to_string()
    }
  }

  fn value_is_nullish(value: &JsValue) -> bool {
    value.is_null() || value.is_undefined()
  }

  fn set_property(target: &JsValue, key: &str, value: &JsValue) -> Result<(), JsError> {
    Reflect::set(target, &JsValue::from_str(key), value)
      .map(|_| ())
      .map_err(|e| JsError::new(&format!("Failed to set JS property {key}: {e:?}")))
  }

  fn object_keys(value: &JsValue) -> Array {
    Object::keys(value.unchecked_ref::<Object>())
  }

  fn element_template_root_unique_id(element: &HtmlElement) -> Option<usize> {
    element
      .get_attribute(constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE)
      .or_else(|| element.get_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE))
      .and_then(|value| value.parse::<usize>().ok())
  }

  fn collect_descendant_template_unique_ids(node: &Node, unique_ids: &mut Vec<usize>) {
    if let Some(element) = node.dyn_ref::<HtmlElement>() {
      if let Some(unique_id) = element
        .get_attribute(constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE)
        .and_then(|value| value.parse::<usize>().ok())
      {
        unique_ids.push(unique_id);
      }
    }

    let mut child = node.first_child();
    while let Some(current) = child {
      child = current.next_sibling();
      Self::collect_descendant_template_unique_ids(&current, unique_ids);
    }
  }

  fn collect_removed_subtree_unique_ids(element: &HtmlElement) -> Vec<usize> {
    let mut unique_ids = Vec::new();
    if let Some(unique_id) = Self::element_template_root_unique_id(element) {
      unique_ids.push(unique_id);
    }
    let mut child = element.first_child();
    while let Some(current) = child {
      child = current.next_sibling();
      Self::collect_descendant_template_unique_ids(&current, &mut unique_ids);
    }
    unique_ids
  }

  fn get_dom_by_unique_id_strong(&self, unique_id: usize) -> Option<HtmlElement> {
    self
      .unique_id_to_dom_map
      .get(&unique_id)?
      .deref()?
      .dyn_into::<HtmlElement>()
      .ok()
  }

  fn collect_clone_nodes(
    node: &Node,
    elements: &mut Vec<HtmlElement>,
    slot_anchors: &mut FnvHashMap<usize, Node>,
  ) {
    if let Some(element) = node.dyn_ref::<HtmlElement>() {
      elements.push(element.clone());
    } else if node.node_type() == Node::COMMENT_NODE {
      if let Some(value) = node.node_value() {
        if let Some(slot_index) = value.strip_prefix(SLOT_ANCHOR_PREFIX) {
          if let Ok(slot_index) = slot_index.parse::<usize>() {
            slot_anchors.insert(slot_index, node.clone());
          }
        }
      }
    }

    let mut child = node.first_child();
    while let Some(current) = child {
      child = current.next_sibling();
      Self::collect_clone_nodes(&current, elements, slot_anchors);
    }
  }

  fn set_style_attribute(
    element: &HtmlElement,
    value: &JsValue,
    transform_vw: bool,
    transform_vh: bool,
    transform_rem: bool,
  ) {
    if Self::value_is_nullish(value) {
      let _ = element.remove_attribute("style");
    } else if let Some(style) = value.as_string() {
      let transformed = transform_inline_style_string(
        &style,
        &TransformerConfig {
          transform_vw,
          transform_vh,
          transform_rem,
        },
      );
      if transformed == style {
        let _ = element.set_attribute("style", &style);
      } else {
        let _ = element.set_attribute("style", &transformed);
      }
    } else if value.is_object() {
      let mut key_value_vec = Vec::new();
      let keys = Self::object_keys(value);
      for index in 0..keys.length() {
        let key = keys.get(index);
        let item_value = Reflect::get(value, &key).unwrap_or(JsValue::UNDEFINED);
        if !Self::value_is_nullish(&item_value) {
          if let Some(key) = key.as_string() {
            key_value_vec.push(key);
            key_value_vec.push(Self::value_to_string(&item_value));
          }
        }
      }
      let transformed = transform_inline_style_key_value_vec(
        key_value_vec,
        &TransformerConfig {
          transform_vw,
          transform_vh,
          transform_rem,
        },
      );
      let _ = element.set_attribute("style", &transformed);
    } else {
      let _ = element.set_attribute("style", &Self::value_to_string(value));
    }
  }

  fn apply_attribute_value(
    &mut self,
    target_unique_id: usize,
    key: &str,
    value: &JsValue,
  ) -> Result<(), JsError> {
    // Event attributes are stored in Rust event maps instead of DOM attributes.
    let (namespace, event_key) = key
      .split_once(':')
      .map(|(namespace, key)| (Some(namespace), key))
      .unwrap_or((None, key));
    let force_worklet = namespace == Some("main-thread");
    for (prefix, event_type) in [
      ("capture-bind", "capture-bind"),
      ("capture-catch", "capture-catch"),
      ("global-bind", "global-bindevent"),
      ("bind", "bindevent"),
      ("catch", "catchevent"),
    ] {
      let Some(event_name) = event_key.strip_prefix(prefix) else {
        continue;
      };
      if event_name.is_empty() {
        continue;
      }
      let event_type = event_type.to_string();
      let event_name = event_name.to_string();
      if Self::value_is_nullish(value) {
        self.add_cross_thread_event(
          target_unique_id,
          event_type.clone(),
          event_name.clone(),
          None,
        );
        self.add_run_worklet_event(target_unique_id, event_type, event_name, None);
      } else if !force_worklet {
        if let Some(identifier) = value.as_string() {
          self.add_cross_thread_event(target_unique_id, event_type, event_name, Some(identifier));
        } else {
          self.add_run_worklet_event(
            target_unique_id,
            event_type,
            event_name,
            Some(value.clone()),
          );
        }
      } else {
        self.add_run_worklet_event(
          target_unique_id,
          event_type,
          event_name,
          Some(value.clone()),
        );
      }
      return Ok(());
    }

    let element = self
      .get_dom_by_unique_id_strong(target_unique_id)
      .ok_or_else(|| JsError::new("Element template target not found"))?;
    let normalized_key = match key {
      "css-id" => constants::CSS_ID_ATTRIBUTE,
      "className" => "class",
      _ => key,
    };

    if normalized_key == constants::CSS_ID_ATTRIBUTE {
      let css_id = if Self::value_is_nullish(value) {
        0
      } else {
        Self::value_to_string(value).parse::<i32>().unwrap_or(0)
      };
      let entry_name = element.get_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE);
      self.set_css_id(vec![target_unique_id], css_id, entry_name)?;
      return Ok(());
    }

    if normalized_key == "class" {
      if Self::value_is_nullish(value) {
        let _ = element.remove_attribute("class");
      } else {
        let _ = element.set_attribute("class", &Self::value_to_string(value));
      }
      if !self.config_enable_css_selector {
        self.update_css_og_style(
          target_unique_id,
          element.get_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE),
        )?;
      }
      return Ok(());
    }

    if normalized_key == "style" {
      Self::set_style_attribute(
        &element,
        value,
        self.config_transform_vw,
        self.config_transform_vh,
        self.config_transform_rem,
      );
      return Ok(());
    }

    if let Some(dataset_key) = normalized_key.strip_prefix("data-") {
      if Self::value_is_nullish(value) {
        let _ = element.remove_attribute(normalized_key);
      } else {
        let _ = element.set_attribute(normalized_key, &Self::value_to_string(value));
      }
      self.add_dataset(target_unique_id, &JsValue::from_str(dataset_key), value)?;
      return Ok(());
    }

    if Self::value_is_nullish(value) {
      let _ = element.remove_attribute(normalized_key);
      let _ = Reflect::delete_property(element.as_ref(), &JsValue::from_str(normalized_key));
    } else if value.is_string() || value.as_f64().is_some() || value.as_bool().is_some() {
      let _ = element.set_attribute(normalized_key, &Self::value_to_string(value));
    } else {
      let _ = Reflect::set(element.as_ref(), &JsValue::from_str(normalized_key), value);
    }
    Ok(())
  }

  fn restore_binding_or_remove(
    &mut self,
    attribute_slots: &[JsValue],
    attribute_bindings: &[InstanceAttributeBinding],
    spread_bindings: &[InstanceSpreadBinding],
    static_bindings: &[InstanceStaticBinding],
    target_unique_id: usize,
    key: &str,
    ignored_spread: Option<(usize, usize)>,
  ) -> Result<(), JsError> {
    for binding in spread_bindings.iter().rev() {
      if binding.target_unique_id != target_unique_id {
        continue;
      }
      if ignored_spread == Some((binding.slot_index, binding.target_unique_id)) {
        continue;
      }
      let Some(value) = attribute_slots.get(binding.slot_index) else {
        continue;
      };
      if Self::value_is_nullish(value) || !value.is_object() || Array::is_array(value) {
        continue;
      }
      let js_key = JsValue::from_str(key);
      if !Reflect::has(value, &js_key).unwrap_or(false) {
        continue;
      }
      let value = Reflect::get(value, &js_key).unwrap_or(JsValue::UNDEFINED);
      if !Self::value_is_nullish(&value) {
        return self.apply_attribute_value(target_unique_id, key, &value);
      }
    }

    if let Some(binding) = attribute_bindings
      .iter()
      .rev()
      .find(|binding| binding.target_unique_id == target_unique_id && binding.key == key)
    {
      if let Some(value) = attribute_slots.get(binding.slot_index) {
        if !Self::value_is_nullish(value) {
          return self.apply_attribute_value(target_unique_id, key, value);
        }
      }
    }

    if let Some(binding) = static_bindings
      .iter()
      .rev()
      .find(|binding| binding.target_unique_id == target_unique_id && binding.key == key)
    {
      self.apply_attribute_value(target_unique_id, key, &binding.value)
    } else {
      self.apply_attribute_value(target_unique_id, key, &JsValue::NULL)
    }
  }

  fn apply_slot_binding(
    &mut self,
    binding: &InstanceAttributeBinding,
    attribute_slots: &[JsValue],
    attribute_bindings: &[InstanceAttributeBinding],
    spread_bindings: &[InstanceSpreadBinding],
    static_bindings: &[InstanceStaticBinding],
  ) -> Result<(), JsError> {
    self.restore_binding_or_remove(
      attribute_slots,
      attribute_bindings,
      spread_bindings,
      static_bindings,
      binding.target_unique_id,
      &binding.key,
      None,
    )
  }

  fn apply_spread_binding(
    &mut self,
    binding: &InstanceSpreadBinding,
    attribute_slots: &[JsValue],
    attribute_bindings: &[InstanceAttributeBinding],
    spread_bindings: &[InstanceSpreadBinding],
    static_bindings: &[InstanceStaticBinding],
    old_keys: Vec<String>,
    value: &JsValue,
  ) -> Result<Vec<String>, JsError> {
    let ignored_spread = Some((binding.slot_index, binding.target_unique_id));
    for key in old_keys {
      self.restore_binding_or_remove(
        attribute_slots,
        attribute_bindings,
        spread_bindings,
        static_bindings,
        binding.target_unique_id,
        &key,
        ignored_spread,
      )?;
    }

    if Self::value_is_nullish(value) || !value.is_object() || Array::is_array(value) {
      return Ok(Vec::new());
    }

    let mut new_keys = Vec::new();
    let keys = Self::object_keys(value);
    for index in 0..keys.length() {
      let key = keys.get(index);
      if let Some(key) = key.as_string() {
        let item_value =
          Reflect::get(value, &JsValue::from_str(&key)).unwrap_or(JsValue::UNDEFINED);
        if Self::value_is_nullish(&item_value) {
          self.restore_binding_or_remove(
            attribute_slots,
            attribute_bindings,
            spread_bindings,
            static_bindings,
            binding.target_unique_id,
            &key,
            ignored_spread,
          )?;
        } else {
          self.restore_binding_or_remove(
            attribute_slots,
            attribute_bindings,
            spread_bindings,
            static_bindings,
            binding.target_unique_id,
            &key,
            None,
          )?;
          new_keys.push(key);
        }
      }
    }
    Ok(new_keys)
  }

  fn apply_initial_element_slots(
    &mut self,
    host: &HtmlElement,
    slot_anchors: &FnvHashMap<usize, Node>,
    element_slots: &JsValue,
  ) -> Result<FnvHashMap<usize, Vec<usize>>, JsError> {
    let mut slot_map = FnvHashMap::default();
    if Self::value_is_nullish(element_slots) || !element_slots.is_object() {
      return Ok(slot_map);
    }

    let keys = Self::object_keys(element_slots);
    for index in 0..keys.length() {
      let key = keys.get(index);
      let Some(key_string) = key.as_string() else {
        continue;
      };
      let Ok(slot_index) = key_string.parse::<usize>() else {
        continue;
      };
      let slot_value = Reflect::get(element_slots, &key).unwrap_or(JsValue::UNDEFINED);
      let mut children = Vec::new();
      if !Self::value_is_nullish(&slot_value) {
        if Array::is_array(&slot_value) {
          let array: Array = slot_value.unchecked_into();
          children.reserve(array.length() as usize);
          for index in 0..array.length() {
            if let Ok(element) = array.get(index).dyn_into::<HtmlElement>() {
              children.push(element);
            }
          }
        } else if let Ok(element) = slot_value.dyn_into::<HtmlElement>() {
          children.push(element);
        }
      }
      for child in children {
        let child_unique_id = Self::element_template_root_unique_id(&child)
          .ok_or_else(|| JsError::new("Element template child missing unique id"))?;
        if let Some(anchor) = slot_anchors.get(&slot_index) {
          let parent = anchor
            .parent_node()
            .ok_or_else(|| JsError::new("Element template slot anchor missing parent"))?;
          parent
            .insert_before(&child, Some(anchor))
            .map_err(|e| JsError::new(&format!("Failed to insert slot child: {e:?}")))?;
        } else {
          host
            .append_child(&child)
            .map_err(|e| JsError::new(&format!("Failed to append typed slot child: {e:?}")))?;
        }
        slot_map
          .entry(slot_index)
          .or_insert_with(Vec::new)
          .push(child_unique_id);
      }
    }
    Ok(slot_map)
  }

  fn apply_typed_attributes(
    &mut self,
    root_unique_id: usize,
    old_attributes: &JsValue,
    new_attributes: &JsValue,
  ) -> Result<JsValue, JsError> {
    if old_attributes.is_object() {
      let old_keys = Self::object_keys(old_attributes);
      for index in 0..old_keys.length() {
        let key = old_keys.get(index);
        if Reflect::has(new_attributes, &key).unwrap_or(false) {
          continue;
        }
        if let Some(key) = key.as_string() {
          self.apply_attribute_value(root_unique_id, &key, &JsValue::NULL)?;
        }
      }
    }

    if new_attributes.is_object() && !Array::is_array(new_attributes) {
      let keys = Self::object_keys(new_attributes);
      for index in 0..keys.length() {
        let key = keys.get(index);
        if let Some(key) = key.as_string() {
          let value =
            Reflect::get(new_attributes, &JsValue::from_str(&key)).unwrap_or(JsValue::UNDEFINED);
          self.apply_attribute_value(root_unique_id, &key, &value)?;
        }
      }
      Ok(new_attributes.clone())
    } else {
      Ok(Object::new().into())
    }
  }

  fn serialize_instance_by_unique_id(&self, root_unique_id: usize) -> Result<JsValue, JsError> {
    let instance = self
      .element_template_instances
      .get(&root_unique_id)
      .ok_or_else(|| JsError::new("Element template instance not found"))?;
    let serialized = Object::new();
    let uid = if instance.handle_id.is_undefined() || instance.handle_id.is_null() {
      JsValue::from_f64(root_unique_id as f64)
    } else {
      instance.handle_id.clone()
    };
    Self::set_property(serialized.as_ref(), "uid", &uid)?;

    match &instance.kind {
      ElementTemplateInstanceKind::Compiled {
        template_key,
        bundle_url,
      } => {
        Self::set_property(
          serialized.as_ref(),
          "templateKey",
          &JsValue::from_str(template_key),
        )?;
        if let Some(bundle_url) = bundle_url {
          Self::set_property(
            serialized.as_ref(),
            "bundleUrl",
            &JsValue::from_str(bundle_url),
          )?;
        }
        let slots = Array::new();
        for slot in &instance.attribute_slots {
          slots.push(slot);
        }
        Self::set_property(serialized.as_ref(), "attributeSlots", slots.as_ref())?;
      }
      ElementTemplateInstanceKind::Typed { tag } => {
        Self::set_property(serialized.as_ref(), "tag", &JsValue::from_str(tag))?;
        if let Some(attributes) = &instance.typed_attributes {
          Self::set_property(serialized.as_ref(), "attributes", attributes)?;
        }
        if let Some(options) = &instance.options {
          Self::set_property(serialized.as_ref(), "options", options)?;
        }
      }
    }

    if !instance.element_slots.is_empty() {
      let slots = Array::new();
      let mut slot_indexes = instance.element_slots.keys().copied().collect::<Vec<_>>();
      slot_indexes.sort_unstable();
      for slot_index in slot_indexes {
        let children_array = Array::new();
        if let Some(children) = instance.element_slots.get(&slot_index) {
          for child_unique_id in children {
            children_array.push(&self.serialize_instance_by_unique_id(*child_unique_id)?);
          }
        }
        slots.set(slot_index as u32, children_array.into());
      }
      Self::set_property(serialized.as_ref(), "elementSlots", slots.as_ref())?;
    }

    Ok(serialized.into())
  }

  fn cleanup_element_template_instance(&mut self, root_unique_id: usize) {
    let Some(instance) = self.element_template_instances.remove(&root_unique_id) else {
      return;
    };
    if self.page_element_unique_id == Some(root_unique_id) {
      self.page_element_unique_id = None;
    }
    for children in instance.element_slots.into_values() {
      for child_unique_id in children {
        self.cleanup_element_template_instance(child_unique_id);
      }
    }
  }

  fn detach_element_template_instance_references(&mut self, root_unique_ids: &FnvHashSet<usize>) {
    for instance in self.element_template_instances.values_mut() {
      instance.element_slots.retain(|_, children| {
        children.retain(|unique_id| !root_unique_ids.contains(unique_id));
        !children.is_empty()
      });
    }
  }

  fn cleanup_element_template_instances(&mut self, unique_ids: Vec<usize>) {
    if unique_ids.is_empty() {
      return;
    }
    let unique_id_set = unique_ids.iter().copied().collect::<FnvHashSet<_>>();
    self.detach_element_template_instance_references(&unique_id_set);
    for root_unique_id in unique_ids {
      self.cleanup_element_template_instance(root_unique_id);
    }
  }

  pub(crate) fn gc_element_template_instances(&mut self) {
    let ids_to_remove = self
      .element_template_instances
      .keys()
      .copied()
      .filter(|unique_id| {
        self
          .unique_id_to_dom_map
          .get(unique_id)
          .and_then(|weak_ref| weak_ref.deref())
          .is_none()
      })
      .collect::<Vec<_>>();
    self.cleanup_element_template_instances(ids_to_remove);
  }
}

#[wasm_bindgen]
impl MainThreadWasmContext {
  pub fn create_element_template_definition(
    &self,
    template_key: String,
    bundle_url: Option<String>,
  ) -> Result<ElementTemplateDefinitionBuilder, JsError> {
    let template = self
      .document
      .create_element("template")
      .map_err(|e| JsError::new(&format!("Failed to create template element: {e:?}")))?
      .unchecked_into::<HtmlTemplateElement>();
    Ok(ElementTemplateDefinitionBuilder {
      definition: ElementTemplateDefinition {
        template_key,
        bundle_url,
        template,
        attribute_bindings: Vec::new(),
        spread_bindings: Vec::new(),
        static_bindings: Vec::new(),
      },
      document: self.document.clone(),
      elements: Vec::new(),
      root_added: false,
      config_transform_vw: self.config_transform_vw,
      config_transform_vh: self.config_transform_vh,
      config_transform_rem: self.config_transform_rem,
    })
  }

  pub fn register_element_template(
    &mut self,
    definition_builder: ElementTemplateDefinitionBuilder,
  ) -> Result<(), JsError> {
    if !definition_builder.root_added {
      return Err(JsError::new("Element template definition missing root"));
    }
    let definition = definition_builder.definition;
    let identity_key =
      Self::template_identity_key(&definition.template_key, definition.bundle_url.as_deref());
    self
      .element_template_definitions
      .insert(identity_key, Rc::new(definition));
    Ok(())
  }

  pub fn create_element_template(
    &mut self,
    template_key: String,
    bundle_url: Option<String>,
    attribute_slots: JsValue,
    element_slots: JsValue,
    handle_id: JsValue,
  ) -> Result<HtmlElement, JsError> {
    let identity_key = Self::template_identity_key(&template_key, bundle_url.as_deref());
    let definition = self
      .element_template_definitions
      .get(&identity_key)
      .cloned()
      .ok_or_else(|| JsError::new(&format!("Element template not found: {identity_key}")))?;

    let fragment = definition
      .template
      .content()
      .clone_node_with_deep(true)
      .map_err(|e| JsError::new(&format!("Failed to clone template content: {e:?}")))?
      .unchecked_into::<DocumentFragment>();
    let root_node = fragment
      .first_child()
      .ok_or_else(|| JsError::new("Element template root missing"))?;
    let root = root_node
      .clone()
      .dyn_into::<HtmlElement>()
      .map_err(|_| JsError::new("Element template root should be an HTMLElement"))?;

    let mut elements = Vec::new();
    let mut slot_anchors = FnvHashMap::default();
    Self::collect_clone_nodes(&root_node, &mut elements, &mut slot_anchors);
    let mut unique_ids_by_index = Vec::with_capacity(elements.len());
    for element in &elements {
      let css_id = element
        .get_attribute(constants::CSS_ID_ATTRIBUTE)
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or(0);
      let unique_id = self.create_element_with_css_id(
        0,
        element.clone(),
        WeakRef::new(element),
        Some(css_id),
        None,
        None,
      );
      unique_ids_by_index.push(unique_id);
      if !self.config_enable_css_selector {
        self.update_css_og_style(
          unique_id,
          element.get_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE),
        )?;
      }
    }
    let root_unique_id = *unique_ids_by_index
      .first()
      .ok_or_else(|| JsError::new("Element template root not registered"))?;
    root
      .set_attribute(
        constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE,
        &root_unique_id.to_string(),
      )
      .map_err(|e| JsError::new(&format!("Failed to mark template root: {e:?}")))?;

    let (attribute_bindings, spread_bindings, static_bindings) = {
      let attribute_bindings = definition
        .attribute_bindings
        .iter()
        .filter_map(|binding| {
          unique_ids_by_index
            .get(binding.element_index)
            .map(|target_unique_id| InstanceAttributeBinding {
              target_unique_id: *target_unique_id,
              slot_index: binding.slot_index,
              key: binding.key.clone(),
            })
        })
        .collect::<Vec<_>>();
      let spread_bindings = definition
        .spread_bindings
        .iter()
        .filter_map(|binding| {
          unique_ids_by_index
            .get(binding.element_index)
            .map(|target_unique_id| InstanceSpreadBinding {
              target_unique_id: *target_unique_id,
              slot_index: binding.slot_index,
            })
        })
        .collect::<Vec<_>>();
      let static_bindings = definition
        .static_bindings
        .iter()
        .filter_map(|binding| {
          unique_ids_by_index
            .get(binding.element_index)
            .map(|target_unique_id| InstanceStaticBinding {
              target_unique_id: *target_unique_id,
              key: binding.key.clone(),
              value: binding.value.clone(),
            })
        })
        .collect::<Vec<_>>();
      (attribute_bindings, spread_bindings, static_bindings)
    };

    let mut attribute_slots = if Array::is_array(&attribute_slots) {
      let array: Array = attribute_slots.clone().unchecked_into();
      (0..array.length())
        .map(|index| array.get(index))
        .collect::<Vec<_>>()
    } else {
      Vec::new()
    };
    if let Some(max_slot_index) = attribute_bindings
      .iter()
      .map(|binding| binding.slot_index)
      .chain(spread_bindings.iter().map(|binding| binding.slot_index))
      .max()
    {
      while attribute_slots.len() <= max_slot_index {
        attribute_slots.push(JsValue::NULL);
      }
    }

    for binding in &attribute_bindings {
      self.apply_slot_binding(
        binding,
        &attribute_slots,
        &attribute_bindings,
        &spread_bindings,
        &static_bindings,
      )?;
    }

    let mut spread_keys = FnvHashMap::default();
    for binding in &spread_bindings {
      let value = attribute_slots
        .get(binding.slot_index)
        .cloned()
        .unwrap_or(JsValue::NULL);
      let keys = self.apply_spread_binding(
        binding,
        &attribute_slots,
        &attribute_bindings,
        &spread_bindings,
        &static_bindings,
        Vec::new(),
        &value,
      )?;
      spread_keys.insert((binding.slot_index, binding.target_unique_id), keys);
    }
    let element_slots = self.apply_initial_element_slots(&root, &slot_anchors, &element_slots)?;

    self.element_template_instances.insert(
      root_unique_id,
      ElementTemplateInstance {
        handle_id,
        kind: ElementTemplateInstanceKind::Compiled {
          template_key: definition.template_key.clone(),
          bundle_url: definition.bundle_url.clone(),
        },
        attribute_slots,
        attribute_bindings,
        spread_bindings,
        static_bindings,
        spread_keys,
        slot_anchors,
        element_slots,
        typed_attributes: None,
        options: None,
      },
    );

    Ok(root)
  }

  pub fn create_typed_element_template(
    &mut self,
    tag: String,
    attributes: JsValue,
    element_slots: JsValue,
    handle_id: JsValue,
    options: JsValue,
  ) -> Result<HtmlElement, JsError> {
    let root = self
      .document
      .create_element(Self::map_lynx_tag_to_html_tag(&tag))
      .map_err(|e| JsError::new(&format!("Failed to create typed template: {e:?}")))?
      .unchecked_into::<HtmlElement>();
    let root_unique_id =
      self.create_element_with_css_id(0, root.clone(), WeakRef::new(&root), Some(0), None, None);
    root
      .set_attribute(
        constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE,
        &root_unique_id.to_string(),
      )
      .map_err(|e| JsError::new(&format!("Failed to mark typed template root: {e:?}")))?;

    let typed_attributes =
      self.apply_typed_attributes(root_unique_id, &Object::new().into(), &attributes)?;
    let slot_source = if !Self::value_is_nullish(&element_slots) {
      element_slots
    } else {
      Reflect::get(&options, &JsValue::from_str("listChildren")).unwrap_or(JsValue::UNDEFINED)
    };
    let element_slots =
      self.apply_initial_element_slots(&root, &FnvHashMap::default(), &slot_source)?;

    self.element_template_instances.insert(
      root_unique_id,
      ElementTemplateInstance {
        handle_id,
        kind: ElementTemplateInstanceKind::Typed { tag },
        attribute_slots: vec![typed_attributes.clone()],
        attribute_bindings: Vec::new(),
        spread_bindings: Vec::new(),
        static_bindings: Vec::new(),
        spread_keys: FnvHashMap::default(),
        slot_anchors: FnvHashMap::default(),
        element_slots,
        typed_attributes: Some(typed_attributes),
        options: if Self::value_is_nullish(&options) {
          None
        } else {
          Some(options)
        },
      },
    );

    Ok(root)
  }

  pub fn set_attribute_of_element_template(
    &mut self,
    element: HtmlElement,
    attribute_slot_index: usize,
    value: JsValue,
    _options: JsValue,
  ) -> Result<(), JsError> {
    let root_unique_id = Self::element_template_root_unique_id(&element)
      .ok_or_else(|| JsError::new("Element template root missing unique id"))?;
    let is_typed = matches!(
      self
        .element_template_instances
        .get(&root_unique_id)
        .map(|instance| &instance.kind),
      Some(ElementTemplateInstanceKind::Typed { .. })
    );

    if is_typed {
      let old_attributes = self
        .element_template_instances
        .get(&root_unique_id)
        .and_then(|instance| instance.typed_attributes.clone())
        .unwrap_or_else(|| Object::new().into());
      let typed_attributes =
        self.apply_typed_attributes(root_unique_id, &old_attributes, &value)?;
      if let Some(instance) = self.element_template_instances.get_mut(&root_unique_id) {
        if instance.attribute_slots.len() <= attribute_slot_index {
          instance
            .attribute_slots
            .resize(attribute_slot_index + 1, JsValue::NULL);
        }
        instance.attribute_slots[attribute_slot_index] = value;
        instance.typed_attributes = Some(typed_attributes);
      }
      return Ok(());
    }

    let (
      attribute_slots,
      attribute_bindings,
      spread_bindings,
      all_attribute_bindings,
      all_spread_bindings,
      static_bindings,
      spread_old_keys,
    ) = {
      let instance = self
        .element_template_instances
        .get_mut(&root_unique_id)
        .ok_or_else(|| JsError::new("Element template instance not found"))?;
      if instance.attribute_slots.len() <= attribute_slot_index {
        instance
          .attribute_slots
          .resize(attribute_slot_index + 1, JsValue::NULL);
      }
      instance.attribute_slots[attribute_slot_index] = value.clone();
      let attribute_bindings = instance
        .attribute_bindings
        .iter()
        .filter(|binding| binding.slot_index == attribute_slot_index)
        .map(|binding| InstanceAttributeBinding {
          target_unique_id: binding.target_unique_id,
          slot_index: binding.slot_index,
          key: binding.key.clone(),
        })
        .collect::<Vec<_>>();
      let all_attribute_bindings = instance
        .attribute_bindings
        .iter()
        .map(|binding| InstanceAttributeBinding {
          target_unique_id: binding.target_unique_id,
          slot_index: binding.slot_index,
          key: binding.key.clone(),
        })
        .collect::<Vec<_>>();
      let spread_bindings = instance
        .spread_bindings
        .iter()
        .filter(|binding| binding.slot_index == attribute_slot_index)
        .map(|binding| InstanceSpreadBinding {
          target_unique_id: binding.target_unique_id,
          slot_index: binding.slot_index,
        })
        .collect::<Vec<_>>();
      let all_spread_bindings = instance
        .spread_bindings
        .iter()
        .map(|binding| InstanceSpreadBinding {
          target_unique_id: binding.target_unique_id,
          slot_index: binding.slot_index,
        })
        .collect::<Vec<_>>();
      let static_bindings = instance
        .static_bindings
        .iter()
        .map(|binding| InstanceStaticBinding {
          target_unique_id: binding.target_unique_id,
          key: binding.key.clone(),
          value: binding.value.clone(),
        })
        .collect::<Vec<_>>();
      let spread_old_keys = spread_bindings
        .iter()
        .map(|binding| {
          (
            (binding.slot_index, binding.target_unique_id),
            instance
              .spread_keys
              .remove(&(binding.slot_index, binding.target_unique_id))
              .unwrap_or_default(),
          )
        })
        .collect::<Vec<_>>();
      (
        instance.attribute_slots.clone(),
        attribute_bindings,
        spread_bindings,
        all_attribute_bindings,
        all_spread_bindings,
        static_bindings,
        spread_old_keys,
      )
    };

    for binding in &attribute_bindings {
      self.apply_slot_binding(
        binding,
        &attribute_slots,
        &all_attribute_bindings,
        &all_spread_bindings,
        &static_bindings,
      )?;
    }

    let mut new_spread_keys = Vec::new();
    for binding in &spread_bindings {
      let old_keys = spread_old_keys
        .iter()
        .find(|(key, _)| *key == (binding.slot_index, binding.target_unique_id))
        .map(|(_, keys)| keys.clone())
        .unwrap_or_default();
      let keys = self.apply_spread_binding(
        binding,
        &attribute_slots,
        &all_attribute_bindings,
        &all_spread_bindings,
        &static_bindings,
        old_keys,
        &value,
      )?;
      new_spread_keys.push(((binding.slot_index, binding.target_unique_id), keys));
    }

    if let Some(instance) = self.element_template_instances.get_mut(&root_unique_id) {
      for (key, keys) in new_spread_keys {
        instance.spread_keys.insert(key, keys);
      }
    }

    Ok(())
  }

  pub fn insert_node_to_element_template(
    &mut self,
    element: HtmlElement,
    slot_index: usize,
    child: HtmlElement,
    reference: Option<HtmlElement>,
  ) -> Result<(), JsError> {
    let root_unique_id = Self::element_template_root_unique_id(&element)
      .ok_or_else(|| JsError::new("Element template root missing unique id"))?;
    let child_unique_id = Self::element_template_root_unique_id(&child)
      .ok_or_else(|| JsError::new("Element template child missing unique id"))?;
    let (anchor, host) =
      if let Some(instance) = self.element_template_instances.get(&root_unique_id) {
        (
          instance.slot_anchors.get(&slot_index).cloned(),
          self
            .get_dom_by_unique_id_strong(root_unique_id)
            .ok_or_else(|| JsError::new("Element template host not found"))?,
        )
      } else if self.page_element_unique_id == Some(root_unique_id) {
        (
          None,
          self
            .get_dom_by_unique_id_strong(root_unique_id)
            .ok_or_else(|| JsError::new("Element template page not found"))?,
        )
      } else {
        return Err(JsError::new("Element template instance not found"));
      };

    if let Some(reference) = reference.as_ref() {
      reference
        .parent_node()
        .ok_or_else(|| JsError::new("Reference node missing parent"))?
        .insert_before(&child, Some(reference))
        .map_err(|e| JsError::new(&format!("Failed to insert before reference: {e:?}")))?;
    } else if let Some(anchor) = anchor {
      anchor
        .parent_node()
        .ok_or_else(|| JsError::new("Element template slot anchor missing parent"))?
        .insert_before(&child, Some(&anchor))
        .map_err(|e| JsError::new(&format!("Failed to insert before anchor: {e:?}")))?;
    } else {
      host
        .append_child(&child)
        .map_err(|e| JsError::new(&format!("Failed to append slot child: {e:?}")))?;
    }

    // Moving a template child between slots must detach it from the old owner
    // before it is recorded on the new owner.
    let mut child_unique_ids = FnvHashSet::default();
    child_unique_ids.insert(child_unique_id);
    self.detach_element_template_instance_references(&child_unique_ids);

    if let Some(instance) = self.element_template_instances.get_mut(&root_unique_id) {
      let children = instance.element_slots.entry(slot_index).or_default();
      if let Some(reference) = reference.as_ref() {
        if let Some(reference_unique_id) = Self::element_template_root_unique_id(reference) {
          if let Some(position) = children
            .iter()
            .position(|unique_id| *unique_id == reference_unique_id)
          {
            children.insert(position, child_unique_id);
          } else {
            children.push(child_unique_id);
          }
        } else {
          children.push(child_unique_id);
        }
      } else {
        children.push(child_unique_id);
      }
    }
    Ok(())
  }

  pub fn remove_node_from_element_template(
    &mut self,
    element: HtmlElement,
    child: HtmlElement,
  ) -> Result<(), JsError> {
    Self::element_template_root_unique_id(&element)
      .ok_or_else(|| JsError::new("Element template root missing unique id"))?;
    Self::element_template_root_unique_id(&child)
      .ok_or_else(|| JsError::new("Element template child missing unique id"))?;
    if let Some(parent) = child.parent_node() {
      parent
        .remove_child(&child)
        .map_err(|e| JsError::new(&format!("Failed to remove slot child: {e:?}")))?;
    }
    self.cleanup_element_template_instances(Self::collect_removed_subtree_unique_ids(&child));
    Ok(())
  }

  pub fn serialize_element_template(&self, element: HtmlElement) -> Result<JsValue, JsError> {
    let root_unique_id = Self::element_template_root_unique_id(&element)
      .ok_or_else(|| JsError::new("Element template root missing unique id"))?;
    self.serialize_instance_by_unique_id(root_unique_id)
  }
}
