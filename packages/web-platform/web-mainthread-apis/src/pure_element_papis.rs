// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use wasm_bindgen::prelude::*;
use web_sys::{console, Element, HtmlElement, Node};
use js_sys::Array;
use std::collections::HashMap;

// Constants for Lynx attributes
const COMPONENT_ID_ATTRIBUTE: &str = "component-id";
const CSS_ID_ATTRIBUTE: &str = "css-id";
const LYNX_COMPONENT_CONFIG_ATTRIBUTE: &str = "lynx-component-config";
const LYNX_DATASET_ATTRIBUTE: &str = "lynx-dataset";
const LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE: &str = "lynx-element-template-marker";
const LYNX_PART_ID_ATTRIBUTE: &str = "lynx-part-id";
const LYNX_TAG_ATTRIBUTE: &str = "lynx-tag";
const LYNX_UNIQUE_ID_ATTRIBUTE: &str = "lynx-unique-id";

// Basic DOM manipulation functions
pub fn append_element_impl(parent: &Element, child: &Element) {
    let _ = parent.append_child(child);
}

pub fn element_is_equal_impl(left: &Element, right: &Element) -> bool {
    left == right
}

pub fn first_element_impl(element: &Element) -> Option<Element> {
    element.first_element_child()
}

pub fn get_children_impl(element: &Element) -> Option<Array> {
    let children = element.children();
    let array = Array::new();
    for i in 0..children.length() {
        if let Some(child) = children.item(i) {
            array.push(&child);
        }
    }
    Some(array)
}

pub fn get_parent_impl(element: &Element) -> Option<Element> {
    element.parent_element()
}

pub fn insert_element_before_impl(parent: &Element, child: &Element, reference: Option<&Element>) {
    let _ = parent.insert_before(child, reference);
}

pub fn last_element_impl(element: &Element) -> Option<Element> {
    element.last_element_child()
}

pub fn next_element_impl(element: &Element) -> Option<Element> {
    element.next_element_sibling()
}

pub fn remove_element_impl(parent: &Element, child: &Element) {
    let _ = parent.remove_child(child);
}

pub fn replace_element_impl(new_element: &Element, old_element: &Element) {
    if let Some(parent) = old_element.parent_node() {
        let _ = parent.replace_child(new_element, old_element);
    }
}

pub fn replace_elements_impl(parent: &Element, new_children: &Array, old_children: Option<&Array>) {
    // Convert JS arrays to Vec for easier manipulation
    let new_children_vec: Vec<Element> = (0..new_children.length())
        .filter_map(|i| new_children.get(i).dyn_into::<Element>().ok())
        .collect();

    if let Some(old_children) = old_children {
        let old_children_vec: Vec<Element> = (0..old_children.length())
            .filter_map(|i| old_children.get(i).dyn_into::<Element>().ok())
            .collect();

        if old_children_vec.is_empty() {
            // Just append new children
            for child in new_children_vec {
                let _ = parent.append_child(&child);
            }
        } else {
            // Remove extra old children
            for old_child in old_children_vec.iter().skip(1) {
                let _ = parent.remove_child(old_child);
            }
            
            // Replace first old child with new children
            if let Some(first_old) = old_children_vec.first() {
                if let Some(first_new) = new_children_vec.first() {
                    let _ = parent.replace_child(first_new, first_old);
                    
                    // Insert remaining new children after the first one
                    for new_child in new_children_vec.iter().skip(1) {
                        let _ = parent.insert_before(new_child, first_new.next_sibling().as_ref());
                    }
                }
            }
        }
    } else {
        // No old children, just append new ones
        for child in new_children_vec {
            let _ = parent.append_child(&child);
        }
    }
}

// Attribute and property functions
pub fn get_component_id_impl(element: &Element) -> Option<String> {
    element.get_attribute(COMPONENT_ID_ATTRIBUTE)
}

pub fn get_element_unique_id_impl(element: &Element) -> i32 {
    element.get_attribute(LYNX_UNIQUE_ID_ATTRIBUTE)
        .and_then(|s| s.parse().ok())
        .unwrap_or(-1)
}

pub fn get_id_impl(element: &Element) -> Option<String> {
    element.get_attribute("id")
}

pub fn set_id_impl(element: &Element, id: Option<&str>) {
    match id {
        Some(id_value) => element.set_attribute("id", id_value).unwrap_or(()),
        None => element.remove_attribute("id"),
    }
}

pub fn get_tag_impl(element: &Element) -> Option<String> {
    element.get_attribute(LYNX_TAG_ATTRIBUTE)
}

pub fn get_classes_impl(element: &Element) -> Array {
    let class_str = element.get_attribute("class").unwrap_or_default();
    let classes: Vec<&str> = class_str.split_whitespace().filter(|s| !s.is_empty()).collect();
    
    let array = Array::new();
    for class in classes {
        array.push(&JsValue::from_str(class));
    }
    array
}

pub fn set_classes_impl(element: &Element, class_name: Option<&str>) {
    match class_name {
        Some(class_value) => element.set_attribute("class", class_value).unwrap_or(()),
        None => element.remove_attribute("class"),
    }
}

pub fn add_class_impl(element: &Element, class_name: &str) {
    let current_class = element.get_attribute("class").unwrap_or_default();
    let new_class = format!("{} {}", current_class, class_name).trim().to_string();
    element.set_attribute("class", &new_class).unwrap_or(());
}

pub fn get_dataset_impl(element: &Element) -> JsValue {
    let dataset_str = element.get_attribute(LYNX_DATASET_ATTRIBUTE);
    match dataset_str {
        Some(data) => {
            // Decode the URI component and parse JSON
            let decoded = js_sys::decode_uri_component(&data).unwrap_or(data.into());
            let decoded_str = decoded.as_string().unwrap_or_default();
            js_sys::JSON::parse(&decoded_str).unwrap_or(JsValue::from(js_sys::Object::new()))
        }
        None => JsValue::from(js_sys::Object::new()),
    }
}

pub fn set_dataset_impl(element: &Element, dataset: &JsValue) {
    let json_str = js_sys::JSON::stringify(dataset).unwrap_or("{}".into());
    let json_str = json_str.as_string().unwrap_or("{}".to_string());
    let encoded = js_sys::encode_uri_component(&json_str);
    let encoded_str = encoded.as_string().unwrap_or_default();
    element.set_attribute(LYNX_DATASET_ATTRIBUTE, &encoded_str).unwrap_or(());
}

pub fn add_dataset_impl(element: &Element, key: &str, value: &JsValue) {
    let current_dataset = get_dataset_impl(element);
    
    // Set the key-value pair in the dataset object
    let dataset_obj = current_dataset.dyn_into::<js_sys::Object>().unwrap_or(js_sys::Object::new());
    js_sys::Reflect::set(&dataset_obj, &JsValue::from_str(key), value).unwrap_or(false);
    
    // Update the element's dataset attribute
    set_dataset_impl(element, &dataset_obj.into());
    
    // Also set the data-* attribute on the element for browser compatibility
    let data_attr = format!("data-{}", key);
    if let Some(str_value) = value.as_string() {
        element.set_attribute(&data_attr, &str_value).unwrap_or(());
    } else {
        element.remove_attribute(&data_attr);
    }
}

pub fn get_data_by_key_impl(element: &Element, key: &str) -> JsValue {
    let dataset = get_dataset_impl(element);
    js_sys::Reflect::get(&dataset, &JsValue::from_str(key)).unwrap_or(JsValue::UNDEFINED)
}

pub fn get_attributes_impl(element: &Element) -> JsValue {
    let attrs = js_sys::Object::new();
    let attribute_names = element.get_attribute_names();
    
    for i in 0..attribute_names.length() {
        if let Some(name) = attribute_names.get(i).as_string() {
            if let Some(value) = element.get_attribute(&name) {
                js_sys::Reflect::set(&attrs, &JsValue::from_str(&name), &JsValue::from_str(&value)).unwrap_or(false);
            }
        }
    }
    
    attrs.into()
}

pub fn get_element_config_impl(element: &Element) -> JsValue {
    let config_str = element.get_attribute(LYNX_COMPONENT_CONFIG_ATTRIBUTE);
    match config_str {
        Some(data) => {
            let decoded = js_sys::decode_uri_component(&data).unwrap_or(data.into());
            let decoded_str = decoded.as_string().unwrap_or_default();
            js_sys::JSON::parse(&decoded_str).unwrap_or(JsValue::from(js_sys::Object::new()))
        }
        None => JsValue::from(js_sys::Object::new()),
    }
}

pub fn set_config_impl(element: &Element, config: &JsValue) {
    let json_str = js_sys::JSON::stringify(config).unwrap_or("{}".into());
    let json_str = json_str.as_string().unwrap_or("{}".to_string());
    let encoded = js_sys::encode_uri_component(&json_str);
    let encoded_str = encoded.as_string().unwrap_or_default();
    element.set_attribute(LYNX_COMPONENT_CONFIG_ATTRIBUTE, &encoded_str).unwrap_or(());
}

pub fn add_config_impl(element: &Element, config_type: &str, value: &JsValue) {
    let current_config = get_element_config_impl(element);
    let config_obj = current_config.dyn_into::<js_sys::Object>().unwrap_or(js_sys::Object::new());
    js_sys::Reflect::set(&config_obj, &JsValue::from_str(config_type), value).unwrap_or(false);
    set_config_impl(element, &config_obj.into());
}

pub fn get_attribute_by_name_impl(element: &Element, name: &str) -> Option<String> {
    element.get_attribute(name)
}

pub fn update_component_id_impl(element: &Element, component_id: &str) {
    element.set_attribute(COMPONENT_ID_ATTRIBUTE, component_id).unwrap_or(());
}

pub fn set_css_id_impl(elements: &Array, css_id: i32) {
    let css_id_str = css_id.to_string();
    for i in 0..elements.length() {
        if let Ok(element) = elements.get(i).dyn_into::<Element>() {
            element.set_attribute(CSS_ID_ATTRIBUTE, &css_id_str).unwrap_or(());
        }
    }
}

pub fn update_component_info_impl(element: &Element, params: &JsValue) {
    // Extract parameters from the params object
    if let Some(component_id) = js_sys::Reflect::get(params, &JsValue::from_str("componentID"))
        .ok()
        .and_then(|v| v.as_string()) 
    {
        update_component_id_impl(element, &component_id);
    }
    
    if let Some(css_id) = js_sys::Reflect::get(params, &JsValue::from_str("cssID"))
        .ok()
        .and_then(|v| v.as_f64())
    {
        element.set_attribute(CSS_ID_ATTRIBUTE, &css_id.to_string()).unwrap_or(());
    }
    
    if let Some(name) = js_sys::Reflect::get(params, &JsValue::from_str("name"))
        .ok()
        .and_then(|v| v.as_string())
    {
        element.set_attribute("name", &name).unwrap_or(());
    }
}

// Style-related functions
pub fn add_inline_style_impl(element: &HtmlElement, key: &str, value: Option<&str>) {
    let style = element.style();
    match value {
        Some(val) => {
            style.set_property(key, val).unwrap_or(());
        }
        None => {
            style.remove_property(key).unwrap_or_default();
        }
    }
}

pub fn set_inline_styles_impl(element: &HtmlElement, styles: &JsValue) {
    if styles.is_string() {
        // Handle string case
        if let Some(style_str) = styles.as_string() {
            element.set_attribute("style", &style_str).unwrap_or(());
        }
    } else if styles.is_object() {
        // Handle object case
        let style_obj = js_sys::Object::from(styles.clone());
        let entries = js_sys::Object::entries(&style_obj);
        let style = element.style();
        
        for i in 0..entries.length() {
            if let Ok(entry) = entries.get(i).dyn_into::<Array>() {
                if let (Some(prop), Some(val)) = (
                    entry.get(0).as_string(),
                    entry.get(1).as_string()
                ) {
                    // Convert camelCase to kebab-case
                    let kebab_prop = camel_to_kebab(&prop);
                    style.set_property(&kebab_prop, &val).unwrap_or(());
                }
            }
        }
    }
}

// Template-related functions
pub fn get_template_parts_impl(template_element: &Element) -> JsValue {
    // Check if element is a template
    if template_element.get_attribute(LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE).is_none() {
        return js_sys::Object::new().into();
    }
    
    let template_unique_id = get_element_unique_id_impl(template_element);
    let parts = js_sys::Object::new();
    
    // Find all part elements within this template
    let selector = format!(
        "[{}=\"{}\"] [{}]:not([{}=\"{}\"] [{}] [{}])",
        LYNX_UNIQUE_ID_ATTRIBUTE, template_unique_id,
        LYNX_PART_ID_ATTRIBUTE,
        LYNX_UNIQUE_ID_ATTRIBUTE, template_unique_id,
        LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE,
        LYNX_PART_ID_ATTRIBUTE
    );
    
    if let Ok(part_elements) = template_element.query_selector_all(&selector) {
        for i in 0..part_elements.length() {
            if let Some(part_element) = part_elements.item(i) {
                if let Some(part_id) = part_element.get_attribute(LYNX_PART_ID_ATTRIBUTE) {
                    js_sys::Reflect::set(&parts, &JsValue::from_str(&part_id), &part_element).unwrap_or(false);
                }
            }
        }
    }
    
    parts.into()
}

pub fn mark_template_element_impl(element: &Element) {
    element.set_attribute(LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE, "").unwrap_or(());
}

pub fn mark_part_element_impl(element: &Element, part_id: &str) {
    element.set_attribute(LYNX_PART_ID_ATTRIBUTE, part_id).unwrap_or(());
}

// Helper function to convert camelCase to kebab-case
fn camel_to_kebab(input: &str) -> String {
    let mut result = String::new();
    for (i, ch) in input.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            result.push('-');
            result.push(ch.to_lowercase().next().unwrap());
        } else {
            result.push(ch.to_lowercase().next().unwrap());
        }
    }
    result
}