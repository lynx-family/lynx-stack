/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::main_thread_context::MainThreadWasmContext;
use crate::constants;
use crate::style_transformer::{
  transform_inline_style_key_value_vec, transform_inline_style_string,
};
use fnv::FnvHashMap;
use js_sys::{Array, Object, Reflect};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::HtmlElement;

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
  value: Option<String>,
}

#[wasm_bindgen]
pub struct ElementTemplateDefinition {
  attribute_bindings: Vec<TemplateAttributeBinding>,
  spread_bindings: Vec<TemplateSpreadBinding>,
  static_bindings: Vec<TemplateStaticBinding>,
}

#[wasm_bindgen]
impl ElementTemplateDefinition {
  #[wasm_bindgen(constructor)]
  pub fn new() -> ElementTemplateDefinition {
    ElementTemplateDefinition {
      attribute_bindings: Vec::new(),
      spread_bindings: Vec::new(),
      static_bindings: Vec::new(),
    }
  }

  pub fn add_attribute_binding(&mut self, element_index: usize, slot_index: usize, key: String) {
    self.attribute_bindings.push(TemplateAttributeBinding {
      element_index,
      slot_index,
      key,
    });
  }

  pub fn add_spread_binding(&mut self, element_index: usize, slot_index: usize) {
    self.spread_bindings.push(TemplateSpreadBinding {
      element_index,
      slot_index,
    });
  }

  pub fn add_static_binding(&mut self, element_index: usize, key: String, value: Option<String>) {
    self.static_bindings.push(TemplateStaticBinding {
      element_index,
      key,
      value,
    });
  }
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
  value: Option<String>,
}

pub(crate) struct ElementTemplateInstance {
  attribute_slots: Vec<JsValue>,
  attribute_bindings: Vec<InstanceAttributeBinding>,
  spread_bindings: Vec<InstanceSpreadBinding>,
  static_bindings: Vec<InstanceStaticBinding>,
  spread_keys: FnvHashMap<(usize, usize), Vec<String>>,
  element_index_to_unique_id: Vec<usize>,
}

impl MainThreadWasmContext {
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

  fn object_keys(value: &JsValue) -> Array {
    Object::keys(value.unchecked_ref::<Object>())
  }

  fn set_style_attribute(&self, element: &HtmlElement, value: &JsValue) {
    if Self::value_is_nullish(value) {
      let _ = element.remove_attribute("style");
    } else if let Some(style) = value.as_string() {
      let transformed = transform_inline_style_string(&style, &self.transformer_config);
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
      let transformed =
        transform_inline_style_key_value_vec(key_value_vec, &self.transformer_config);
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
      .unique_id_to_dom_map
      .get(&target_unique_id)
      .and_then(|weak_ref| weak_ref.deref())
      .and_then(|value| value.dyn_into::<HtmlElement>().ok())
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
      self.set_style_attribute(&element, value);
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
      let element = self
        .unique_id_to_dom_map
        .get(&target_unique_id)
        .and_then(|weak_ref| weak_ref.deref())
        .and_then(|value| value.dyn_into::<HtmlElement>().ok())
        .ok_or_else(|| JsError::new("Element template target not found"))?;
      let normalized_key = match key {
        "css-id" => constants::CSS_ID_ATTRIBUTE,
        "className" => "class",
        _ => key,
      };

      if normalized_key == constants::CSS_ID_ATTRIBUTE {
        let css_id = binding
          .value
          .as_deref()
          .and_then(|value| value.parse::<i32>().ok())
          .unwrap_or(0);
        let entry_name = element.get_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE);
        return self.set_css_id(vec![target_unique_id], css_id, entry_name);
      }

      if normalized_key == "class" {
        if let Some(value) = binding.value.as_deref() {
          let _ = element.set_attribute("class", value);
        } else {
          let _ = element.remove_attribute("class");
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
        if let Some(value) = binding.value.as_deref() {
          let _ = element.set_attribute("style", value);
        } else {
          let _ = element.remove_attribute("style");
        }
        return Ok(());
      }

      if let Some(dataset_key) = normalized_key.strip_prefix("data-") {
        let dataset_value = if let Some(value) = binding.value.as_deref() {
          let _ = element.set_attribute(normalized_key, value);
          JsValue::from_str(value)
        } else {
          let _ = element.remove_attribute(normalized_key);
          JsValue::NULL
        };
        self.add_dataset(
          target_unique_id,
          &JsValue::from_str(dataset_key),
          &dataset_value,
        )?;
        return Ok(());
      }

      if let Some(value) = binding.value.as_deref() {
        let _ = element.set_attribute(normalized_key, value);
      } else {
        let _ = element.remove_attribute(normalized_key);
        let _ = Reflect::delete_property(element.as_ref(), &JsValue::from_str(normalized_key));
      }
      return Ok(());
    }
    self.apply_attribute_value(target_unique_id, key, &JsValue::NULL)
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
    for root_unique_id in ids_to_remove {
      self.element_template_instances.remove(&root_unique_id);
    }
  }
}

#[wasm_bindgen]
impl MainThreadWasmContext {
  pub fn transform_element_template_style(&self, style: String) -> String {
    transform_inline_style_string(&style, &self.transformer_config)
  }

  pub fn create_element_template_instance(&mut self, root_unique_id: usize) -> Result<(), JsError> {
    self.element_template_instances.insert(
      root_unique_id,
      ElementTemplateInstance {
        attribute_slots: Vec::new(),
        attribute_bindings: Vec::new(),
        spread_bindings: Vec::new(),
        static_bindings: Vec::new(),
        spread_keys: FnvHashMap::default(),
        element_index_to_unique_id: Vec::new(),
      },
    );

    Ok(())
  }

  pub fn add_element_template_instance_element(
    &mut self,
    root_unique_id: usize,
    element_index: usize,
    target_unique_id: usize,
  ) -> Result<(), JsError> {
    let Some(instance) = self.element_template_instances.get_mut(&root_unique_id) else {
      return Err(JsError::new("Element template instance not found"));
    };
    if instance.element_index_to_unique_id.len() <= element_index {
      instance
        .element_index_to_unique_id
        .resize(element_index + 1, usize::MAX);
    }
    instance.element_index_to_unique_id[element_index] = target_unique_id;
    Ok(())
  }

  pub fn finish_element_template_instance(
    &mut self,
    definition: &ElementTemplateDefinition,
    root_unique_id: usize,
  ) -> Result<(), JsError> {
    let (unique_ids_by_index, mut attribute_slots) = {
      let Some(instance) = self.element_template_instances.get(&root_unique_id) else {
        return Err(JsError::new("Element template instance not found"));
      };
      (
        instance.element_index_to_unique_id.clone(),
        instance.attribute_slots.clone(),
      )
    };

    let attribute_bindings = definition
      .attribute_bindings
      .iter()
      .filter_map(|binding| {
        unique_ids_by_index
          .get(binding.element_index)
          .copied()
          .filter(|unique_id| *unique_id != usize::MAX)
          .map(|target_unique_id| InstanceAttributeBinding {
            target_unique_id,
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
          .copied()
          .filter(|unique_id| *unique_id != usize::MAX)
          .map(|target_unique_id| InstanceSpreadBinding {
            target_unique_id,
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
          .copied()
          .filter(|unique_id| *unique_id != usize::MAX)
          .map(|target_unique_id| InstanceStaticBinding {
            target_unique_id,
            key: binding.key.clone(),
            value: binding.value.clone(),
          })
      })
      .collect::<Vec<_>>();

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

    if let Some(instance) = self.element_template_instances.get_mut(&root_unique_id) {
      instance.attribute_slots = attribute_slots;
      instance.attribute_bindings = attribute_bindings;
      instance.spread_bindings = spread_bindings;
      instance.static_bindings = static_bindings;
      instance.spread_keys = spread_keys;
    }
    Ok(())
  }

  pub fn remove_element_template_instance_by_id(
    &mut self,
    root_unique_id: usize,
  ) -> Result<(), JsError> {
    self.element_template_instances.remove(&root_unique_id);
    Ok(())
  }

  pub fn set_typed_element_template_attribute(
    &mut self,
    root_unique_id: usize,
    key: String,
    value: JsValue,
  ) -> Result<(), JsError> {
    self.apply_attribute_value(root_unique_id, &key, &value)
  }

  pub fn set_attribute_of_element_template_by_id(
    &mut self,
    root_unique_id: usize,
    attribute_slot_index: usize,
    value: JsValue,
  ) -> Result<(), JsError> {
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
      let changed_attribute_bindings = instance
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
      let changed_spread_bindings = instance
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
      let spread_old_keys = instance
        .spread_bindings
        .iter()
        .filter(|binding| binding.slot_index == attribute_slot_index)
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
        changed_attribute_bindings,
        changed_spread_bindings,
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
}
