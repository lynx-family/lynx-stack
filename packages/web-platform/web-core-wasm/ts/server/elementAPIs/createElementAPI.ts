/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MainThreadServerContext } from '../wasm.js';
import { LYNX_TAG_TO_HTML_TAG_MAP, uniqueIdSymbol } from '../../constants.js';
import type {
  ElementPAPIs,
  DecoratedHTMLElement,
  ComponentAtIndexCallback,
  EnqueueComponentCallback,
  LynxEventType,
  ElementPAPIEventHandler,
  FlushElementTreeOptions,
  Cloneable,
} from '../../../types/index.js';

interface SSRBinding {
  wasmContext?: MainThreadServerContext;
  ssrResult?: string;
}

class ServerElement {
  [uniqueIdSymbol]: number;
  tagName: string;
  attributes: Record<string, string> = {};
  style: Record<string, string> = {};
  dataset: Record<string, Cloneable> = {};
  children: ServerElement[] = [];
  parentNode: ServerElement | null = null;
  classList: Set<string> = new Set();

  constructor(tagName: string, uniqueId: number) {
    this.tagName = tagName;
    this[uniqueIdSymbol] = uniqueId;
  }

  getAttribute(key: string) {
    return this.attributes[key] ?? null;
  }

  setAttribute(key: string, value: string) {
    this.attributes[key] = value;
  }

  removeAttribute(key: string) {
    delete this.attributes[key];
  }
}

export function createElementAPI(mtsBinding: SSRBinding): ElementPAPIs {
  const wasmContext = new MainThreadServerContext();

  // Attach context
  mtsBinding.wasmContext = wasmContext;

  // Helper to create element
  function createServerElement(tagName: string): ServerElement {
    const uniqueId = wasmContext.create_element(tagName);
    return new ServerElement(tagName, uniqueId);
  }

  return {
    __CreateView(_parentComponentUniqueId: number) {
      return createServerElement('x-view') as unknown as DecoratedHTMLElement;
    },
    __CreateText(_parentComponentUniqueId: number) {
      return createServerElement('x-text') as unknown as DecoratedHTMLElement;
    },
    __CreateImage(_parentComponentUniqueId: number) {
      return createServerElement('x-image') as unknown as DecoratedHTMLElement;
    },
    __CreateRawText(text: string) {
      const el = createServerElement('raw-text');
      el.setAttribute('text', text);
      wasmContext.set_attribute(el[uniqueIdSymbol], 'text', text);
      return el as unknown as DecoratedHTMLElement;
    },
    __CreateScrollView(_parentComponentUniqueId: number) {
      return createServerElement(
        'scroll-view',
      ) as unknown as DecoratedHTMLElement;
    },
    __CreateElement(tagName: string, _parentComponentUniqueId: number) {
      const htmlTag = LYNX_TAG_TO_HTML_TAG_MAP[tagName] ?? tagName;
      return createServerElement(htmlTag) as unknown as DecoratedHTMLElement;
    },
    __CreateComponent(
      _parentComponentUniqueId: number,
      _componentID: string,
      _cssID: number,
      entryName: string,
      name: string,
    ) {
      const el = createServerElement('x-view'); // Component host
      // TODO: Handle componentID/cssID if needed by server context
      if (entryName) {
        el.setAttribute('lynx-entry-name', entryName);
        wasmContext.set_attribute(
          el[uniqueIdSymbol],
          'lynx-entry-name',
          entryName,
        );
      }
      if (name) {
        el.setAttribute('name', name);
        wasmContext.set_attribute(el[uniqueIdSymbol], 'name', name);
      }
      return el as unknown as DecoratedHTMLElement;
    },
    __CreateWrapperElement(_parentComponentUniqueId: number) {
      return createServerElement(
        'lynx-wrapper',
      ) as unknown as DecoratedHTMLElement;
    },
    __CreateList(
      _parentComponentUniqueId: number,
      componentAtIndex: ComponentAtIndexCallback,
      enqueueComponent: EnqueueComponentCallback,
    ) {
      const el = createServerElement('x-list');
      // @ts-ignore
      el.componentAtIndex = componentAtIndex;
      // @ts-ignore
      el.enqueueComponent = enqueueComponent;
      return el as unknown as DecoratedHTMLElement;
    },
    __CreatePage(_componentID: string, _cssID: number) {
      const el = createServerElement('div');
      el.setAttribute('part', 'page');
      wasmContext.set_attribute(el[uniqueIdSymbol], 'part', 'page');
      return el as unknown as DecoratedHTMLElement;
    },

    __AppendElement(parent: unknown, child: unknown) {
      const p = parent as ServerElement;
      const c = child as ServerElement;
      p.children.push(c);
      c.parentNode = p;
      wasmContext.append_child(p[uniqueIdSymbol], c[uniqueIdSymbol]);
    },

    __SetAttribute(
      element: unknown,
      name: string,
      value: string | boolean | null | undefined,
    ) {
      const el = element as ServerElement;
      if (value == null) {
        el.removeAttribute(name);
        wasmContext.set_attribute(el[uniqueIdSymbol], name, '');
      } else {
        const valStr = value.toString();
        el.setAttribute(name, valStr);
        wasmContext.set_attribute(el[uniqueIdSymbol], name, valStr);
      }
    },

    __SetClasses(element: unknown, classname: string | null) {
      const el = element as ServerElement;
      if (classname) {
        el.setAttribute('class', classname);
        wasmContext.set_attribute(el[uniqueIdSymbol], 'class', classname);
        el.classList.clear();
        classname.split(/\s+/).forEach(c => c && el.classList.add(c));
      } else {
        el.removeAttribute('class');
        wasmContext.set_attribute(el[uniqueIdSymbol], 'class', '');
        el.classList.clear();
      }
    },

    __AddClass(element: unknown, className: string) {
      const el = element as ServerElement;
      el.classList.add(className);
      const newClass = Array.from(el.classList).join(' ');
      el.setAttribute('class', newClass);
      wasmContext.set_attribute(el[uniqueIdSymbol], 'class', newClass);
    },

    __SetInlineStyles(
      element: unknown,
      value: string | Record<string, string> | undefined,
    ) {
      const el = element as ServerElement;
      if (typeof value === 'string') {
        el.setAttribute('style', value);
        wasmContext.set_attribute(el[uniqueIdSymbol], 'style', value);
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([k, v]) => {
          const key = k;
          const val = v as string;
          el.style[key] = val;
          wasmContext.set_style(el[uniqueIdSymbol], key, val);
        });
      }
    },

    __AddInlineStyle(
      element: unknown,
      key: string | number,
      value: string | number | null | undefined,
    ) {
      const el = element as ServerElement;
      const keyStr = key.toString();
      const valStr = value?.toString() ?? '';
      el.style[keyStr] = valStr;
      wasmContext.set_style(el[uniqueIdSymbol], keyStr, valStr);
    },

    __FlushElementTree(element: unknown, options?: FlushElementTreeOptions) { // options unused but kept for signature
      const _options = options; // Suppress unused
      const el = element as ServerElement;
      const uid = el[uniqueIdSymbol];
      const html = wasmContext.generate_html_segment(uid);
      mtsBinding.ssrResult = html;
    },

    __GetID(element: unknown) {
      return (element as ServerElement).getAttribute('id');
    },
    __SetID(element: unknown, id: string | null) {
      const el = element as ServerElement;
      if (id) {
        el.setAttribute('id', id);
        wasmContext.set_attribute(el[uniqueIdSymbol], 'id', id);
      } else {
        el.removeAttribute('id');
        wasmContext.set_attribute(el[uniqueIdSymbol], 'id', '');
      }
    },
    __GetTag(element: unknown) {
      return (element as ServerElement).tagName.toLowerCase();
    },
    __GetElementUniqueID(element: unknown) {
      return (element as ServerElement)[uniqueIdSymbol];
    },

    __GetAttributes(element: unknown) {
      return (element as ServerElement).attributes;
    },
    __GetAttributeByName(element: unknown, name: string) {
      return (element as ServerElement).getAttribute(name);
    },
    __GetClasses(element: unknown) {
      return Array.from((element as ServerElement).classList);
    },
    __GetParent(element: unknown) {
      return (element as ServerElement)
        .parentNode as unknown as DecoratedHTMLElement;
    },
    __GetChildren(element: unknown) {
      return (element as ServerElement)
        .children as unknown as DecoratedHTMLElement[];
    },

    __AddEvent(
      element: unknown,
      type: LynxEventType,
      name: string,
      listenerId: ElementPAPIEventHandler,
    ) {
      // skip
    },
    __GetEvent() {
      throw new Error('__GetEvent is not implemented in SSR');
    },
    __GetEvents() {
      throw new Error('__GetEvents is not implemented in SSR');
    },
    __SetEvents() {
      throw new Error('__SetEvents is not implemented in SSR');
    },

    __UpdateListCallbacks() {
      throw new Error('__UpdateListCallbacks is not implemented in SSR');
    },

    __GetConfig() {
      throw new Error('__GetConfig is not implemented in SSR');
    },
    __SetConfig() {
      throw new Error('__SetConfig is not implemented in SSR');
    },
    __GetElementConfig() {
      throw new Error('__GetElementConfig is not implemented in SSR');
    },
    __GetComponentID() {
      throw new Error('__GetComponentID is not implemented in SSR');
    },

    __GetDataset(element: unknown) {
      return (element as ServerElement).dataset;
    },
    __SetDataset(_element: unknown, _dataset: Record<string, Cloneable>) {
      throw new Error('__SetDataset is not implemented in SSR');
    },
    __AddDataset(_element: unknown, _key: string, _value: Cloneable) {
      throw new Error('__AddDataset is not implemented in SSR');
    },
    __GetDataByKey(element: unknown, key: string) {
      return (element as ServerElement).dataset[key];
    },

    __ElementIsEqual(left: unknown, right: unknown) {
      return left === right;
    },

    __FirstElement(element: unknown) {
      return (element as ServerElement)
        .children[0] as unknown as DecoratedHTMLElement;
    },
    __LastElement(element: unknown) {
      const children = (element as ServerElement).children;
      return children[children.length - 1] as unknown as DecoratedHTMLElement;
    },
    __NextElement(element: unknown) {
      const el = element as ServerElement;
      if (!el.parentNode) return null;
      const idx = el.parentNode.children.indexOf(el);
      if (idx >= 0 && idx < el.parentNode.children.length - 1) {
        return el.parentNode
          .children[idx + 1] as unknown as DecoratedHTMLElement;
      }
      return null;
    },

    __RemoveElement(_parent: unknown, _child: unknown) {
      throw new Error('__RemoveElement is not implemented in SSR');
    },
    __ReplaceElement(_newEl: unknown, _oldEl: unknown) {
      throw new Error('__ReplaceElement is not implemented in SSR');
    },
    __SwapElement(_a: unknown, _b: unknown) {
      throw new Error('__SwapElement is not implemented in SSR');
    },

    __SetCSSId() {
      throw new Error('__SetCSSId is not implemented in SSR');
    },
    __AddConfig() {
      throw new Error('__AddConfig is not implemented in SSR');
    },
    __UpdateComponentInfo() {
      throw new Error('__UpdateComponentInfo is not implemented in SSR');
    },
    __UpdateComponentID() {
      throw new Error('__UpdateComponentID is not implemented in SSR');
    },

    __MarkTemplateElement() {
      throw new Error('__MarkTemplateElement is not implemented in SSR');
    },
    __MarkPartElement() {
      throw new Error('__MarkPartElement is not implemented in SSR');
    },
    __GetTemplateParts() {
      throw new Error('__GetTemplateParts is not implemented in SSR');
    },
    __GetPageElement() {
      throw new Error('__GetPageElement is not implemented in SSR');
    },
    __InsertElementBefore(_parent: unknown, _child: unknown, _ref: unknown) {
      throw new Error('__InsertElementBefore is not implemented in SSR');
    },
    __ReplaceElements(
      _parent: unknown,
      _newChildren: unknown,
      _oldChildren: unknown,
    ) {
      throw new Error('__ReplaceElements is not implemented in SSR');
    },
  };
}
