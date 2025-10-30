import {
  cssIdAttribute,
  componentAtIndexPropertyName,
  enqueueComponentPropertyName,
  type UpdateListInfoAttributeValue,
  type ComponentAtIndexCallback,
  type EnqueueComponentCallback,
  lynxUniqueIdAttribute,
} from '@lynx-js/web-constants';
import { __MarkTemplateElement } from './pureElementPAPIs.js';
import { componentIdAttribute } from '@lynx-js/web-constants';

export function create_element_js_impl(
  document: Document,
  html_tag: string,
  unique_id: number,
) {
  const element = document.createElement(html_tag);
  // @ts-expect-error
  element[lynxUniqueIdAttribute] = unique_id;
  return element;
}

export function prepare_component_element_js_impl(
  component_element: HTMLElement,
  component_id: string,
  css_id: number,
  name: string,
) {
  component_element.setAttribute(cssIdAttribute, css_id + '');
  component_element.setAttribute(componentIdAttribute, component_id);
  name && component_element.setAttribute('name', name);
}

export function update_list_info_js_impl(
  element: HTMLElement,
  unique_id: number,
  list_info: UpdateListInfoAttributeValue | null | undefined,
) {
  if (!list_info) {
    return;
  }
  queueMicrotask(() => {
    const componentAtIndex = (element as any)[componentAtIndexPropertyName] as
      | ComponentAtIndexCallback
      | undefined;
    const enqueueComponent = (element as any)[enqueueComponentPropertyName] as
      | EnqueueComponentCallback
      | undefined;
    const { insertAction, removeAction } = list_info;
    for (const action of insertAction) {
      componentAtIndex?.(
        element,
        unique_id,
        action.position,
        0,
        false,
      );
    }
    for (const action of removeAction) {
      enqueueComponent?.(element, unique_id, action.position);
    }
  });
}

export function set_attribute_js_impl(
  element: HTMLElement,
  name: string,
  value: string | number | null | undefined,
) {
  value == null
    ? element.removeAttribute(name)
    : element.setAttribute(name, value + '');
}
