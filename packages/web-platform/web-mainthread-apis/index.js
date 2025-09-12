// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { referenceTypes } from 'wasm-feature-detect';

export let wasm;

export async function initWasm() {
  const supportsReferenceTypes = await referenceTypes();
  if (supportsReferenceTypes) {
    wasm = await import(
      /* webpackMode: "eager" */
      /* webpackFetchPriority: "high" */
      /* webpackChunkName: "standard-wasm-chunk" */
      /* webpackPrefetch: true */
      /* webpackPreload: true */
      './standard.js'
    );
  } else {
    wasm = await import(
      /* webpackMode: "lazy" */
      /* webpackChunkName: "legacy-wasm-chunk" */
      /* webpackPrefetch: false */
      /* webpackPreload: false */
      './legacy.js'
    );
  }
}

// Rust implementation wrappers for TypeScript compatibility
export function prepareMainThreadAPIs(config) {
  if (!wasm) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }
  // Call the Rust function
  return wasm.prepare_main_thread_apis();
}

export function createMainThreadGlobalThis(config) {
  if (!wasm) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }
  return wasm.create_main_thread_global_this(config);
}

export function createMainThreadLynx(config, systemInfo) {
  if (!wasm) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }
  return wasm.create_main_thread_lynx(config, systemInfo);
}

// Export all pure element APIs
export const __AppendElement = (parent, child) => wasm?.append_element(parent, child);
export const __ElementIsEqual = (left, right) => wasm?.element_is_equal(left, right);
export const __FirstElement = (element) => wasm?.first_element(element);
export const __GetChildren = (element) => wasm?.get_children(element);
export const __GetParent = (element) => wasm?.get_parent(element);
export const __InsertElementBefore = (parent, child, ref) => wasm?.insert_element_before(parent, child, ref);
export const __LastElement = (element) => wasm?.last_element(element);
export const __NextElement = (element) => wasm?.next_element(element);
export const __RemoveElement = (parent, child) => wasm?.remove_element(parent, child);
export const __ReplaceElement = (newElement, oldElement) => wasm?.replace_element(newElement, oldElement);
export const __ReplaceElements = (parent, newChildren, oldChildren) => wasm?.replace_elements(parent, newChildren, oldChildren);

// Attribute and property APIs
export const __GetComponentID = (element) => wasm?.get_component_id(element);
export const __GetElementUniqueID = (element) => wasm?.get_element_unique_id(element);
export const __GetID = (element) => wasm?.get_id(element);
export const __SetID = (element, id) => wasm?.set_id(element, id);
export const __GetTag = (element) => wasm?.get_tag(element);
export const __GetClasses = (element) => wasm?.get_classes(element);
export const __SetClasses = (element, className) => wasm?.set_classes(element, className);
export const __AddClass = (element, className) => wasm?.add_class(element, className);
export const __AddInlineStyle = (element, key, value) => wasm?.add_inline_style(element, key, value);
export const __SetInlineStyles = (element, styles) => wasm?.set_inline_styles(element, styles);
export const __GetDataset = (element) => wasm?.get_dataset(element);
export const __SetDataset = (element, dataset) => wasm?.set_dataset(element, dataset);
export const __AddDataset = (element, key, value) => wasm?.add_dataset(element, key, value);
export const __GetDataByKey = (element, key) => wasm?.get_data_by_key(element, key);
export const __GetAttributes = (element) => wasm?.get_attributes(element);
export const __GetElementConfig = (element) => wasm?.get_element_config(element);
export const __SetConfig = (element, config) => wasm?.set_config(element, config);
export const __AddConfig = (element, type, value) => wasm?.add_config(element, type, value);
export const __GetAttributeByName = (element, name) => wasm?.get_attribute_by_name(element, name);
export const __UpdateComponentID = (element, componentId) => wasm?.update_component_id(element, componentId);
export const __SetCSSId = (elements, cssId) => wasm?.set_css_id(elements, cssId);
export const __UpdateComponentInfo = (element, params) => wasm?.update_component_info(element, params);

// Template APIs
export const __GetTemplateParts = (templateElement) => wasm?.get_template_parts(templateElement);
export const __MarkTemplateElement = (element) => wasm?.mark_template_element(element);
export const __MarkPartElement = (element, partId) => wasm?.mark_part_element(element, partId);

// Utility functions
export function createCrossThreadEvent(event, eventName) {
  return wasm?.create_cross_thread_event_wrapper(event, eventName);
}

export function createExposureService(rootDom, postExposure) {
  return wasm?.create_exposure_service_wrapper(rootDom, postExposure);
}

export function decodeCssOG(classes, styleInfo, cssId) {
  return wasm?.decode_css_og_wrapper(classes, styleInfo, cssId);
}

// Style processing functions
export function flattenStyleInfo(styleInfo, enableCssSelector) {
  return wasm?.flatten_style_info_wrapper(styleInfo, enableCssSelector);
}

export function transformToWebCss(styleInfo) {
  return wasm?.transform_to_web_css_wrapper(styleInfo);
}

export function genCssContent(styleInfo, pageConfig, entryName) {
  return wasm?.gen_css_content_wrapper(styleInfo, pageConfig, entryName);
}

export function genCssOGInfo(styleInfo) {
  return wasm?.gen_css_og_info_wrapper(styleInfo);
}

export function appendStyleElement(styleInfo, pageConfig, rootDom, document, entryName, ssrHydrateInfo) {
  return wasm?.append_style_element_wrapper(styleInfo, pageConfig, rootDom, document, entryName, ssrHydrateInfo);
}

// CSS property map functions
export function queryCSSProperty(index) {
  return wasm?.query_css_property_wrapper(index);
}

export function queryCSSPropertyNumber(name) {
  return wasm?.query_css_property_number_wrapper(name);
}

// Style transformation functions
export function transformInlineStyleString(input) {
  return wasm?.transform_inline_style_string_tokenizer(input);
}

export function transformParsedStyles(styles) {
  return wasm?.transform_parsed_styles_tokenizer(styles);
}

// Tokenizer functions
export function tokenizeCSS(input) {
  return wasm?.tokenize_css_wrapper(input);
}

export function parseCSSDeclarations(cssText) {
  return wasm?.parse_css_declarations_wrapper(cssText);
}

export function serializeCSSDeclarations(declarations) {
  return wasm?.serialize_css_declarations_wrapper(declarations);
}
