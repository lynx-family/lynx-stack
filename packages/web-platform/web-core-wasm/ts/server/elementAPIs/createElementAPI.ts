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
  Cloneable,
  UpdateListInfoAttributeValue,
} from '../../types/index.js';

export type SSRBinding = {
  wasmContext?: MainThreadServerContext;
  ssrResult?: string;
};

interface ElementHandle {
  [uniqueIdSymbol]: number;
}

function getUniqueId(element: unknown): number {
  return (element as ElementHandle)[uniqueIdSymbol];
}

const __ElementIsEqual = (left: unknown, right: unknown) => {
  return getUniqueId(left) === getUniqueId(right);
};

const __GetElementUniqueID = (element: unknown) => {
  return getUniqueId(element);
};

// Throwing/Stub Implementations
const __GetID = (_element: unknown) => {
  throw new Error('__GetID is not implemented in SSR');
};

const __GetTag = (_element: unknown) => {
  throw new Error('__GetTag is not implemented in SSR');
};

const __GetAttributes = (_element: unknown) => {
  throw new Error('__GetAttributes is not implemented in SSR');
};

const __GetAttributeByName = (_element: unknown, _name: string) => {
  throw new Error('__GetAttributeByName is not implemented in SSR');
};

const __GetClasses = (_element: unknown) => {
  throw new Error('__GetClasses is not implemented in SSR');
};

const __GetParent = (_element: unknown) => {
  throw new Error('__GetParent is not implemented in SSR');
};

const __GetChildren = (_element: unknown) => {
  throw new Error('__GetChildren is not implemented in SSR');
};

const __AddEvent = () => {
  // skip
};

const __GetEvent = () => {
  throw new Error('__GetEvent is not implemented in SSR');
};

const __GetEvents = () => {
  throw new Error('__GetEvents is not implemented in SSR');
};

const __SetEvents = () => {
  throw new Error('__SetEvents is not implemented in SSR');
};

const __UpdateListCallbacks = () => {
  throw new Error('__UpdateListCallbacks is not implemented in SSR');
};

const __GetConfig = () => {
  throw new Error('__GetConfig is not implemented in SSR');
};

const __SetConfig = () => {
  throw new Error('__SetConfig is not implemented in SSR');
};

const __GetElementConfig = () => {
  throw new Error('__GetElementConfig is not implemented in SSR');
};

const __GetComponentID = () => {
  throw new Error('__GetComponentID is not implemented in SSR');
};

const __GetDataset = (_element: unknown) => {
  throw new Error('__GetDataset is not implemented in SSR');
};

const __SetDataset = (
  _element: unknown,
  _dataset: Record<string, Cloneable>,
) => {
  throw new Error('__SetDataset is not implemented in SSR');
};

const __AddDataset = (_element: unknown, _key: string, _value: Cloneable) => {
  throw new Error('__AddDataset is not implemented in SSR');
};

const __GetDataByKey = (_element: unknown, _key: string) => {
  throw new Error('__GetDataByKey is not implemented in SSR');
};

const __FirstElement = (_element: unknown) => {
  throw new Error('__FirstElement is not implemented in SSR');
};

const __LastElement = (_element: unknown) => {
  throw new Error('__LastElement is not implemented in SSR');
};

const __NextElement = (_element: unknown) => {
  throw new Error('__NextElement is not implemented in SSR');
};

const __RemoveElement = (_parent: unknown, _child: unknown) => {
  throw new Error('__RemoveElement is not implemented in SSR');
};

const __ReplaceElement = (_newEl: unknown, _oldEl: unknown) => {
  throw new Error('__ReplaceElement is not implemented in SSR');
};

const __SwapElement = (_a: unknown, _b: unknown) => {
  throw new Error('__SwapElement is not implemented in SSR');
};

const __SetCSSId = () => {
  throw new Error('__SetCSSId is not implemented in SSR');
};

const __AddConfig = () => {
  throw new Error('__AddConfig is not implemented in SSR');
};

const __UpdateComponentInfo = () => {
  throw new Error('__UpdateComponentInfo is not implemented in SSR');
};

const __UpdateComponentID = () => {
  throw new Error('__UpdateComponentID is not implemented in SSR');
};

const __MarkTemplateElement = () => {
  throw new Error('__MarkTemplateElement is not implemented in SSR');
};

const __MarkPartElement = () => {
  throw new Error('__MarkPartElement is not implemented in SSR');
};

const __GetTemplateParts = () => {
  throw new Error('__GetTemplateParts is not implemented in SSR');
};

const __GetPageElement = () => {
  throw new Error('__GetPageElement is not implemented in SSR');
};

const __InsertElementBefore = (
  _parent: unknown,
  _child: unknown,
  _ref: unknown,
) => {
  throw new Error('__InsertElementBefore is not implemented in SSR');
};

const __ReplaceElements = (
  _parent: unknown,
  _newChildren: unknown,
  _oldChildren: unknown,
) => {
  throw new Error('__ReplaceElements is not implemented in SSR');
};

export function createElementAPI(mtsBinding: SSRBinding): ElementPAPIs {
  const wasmContext = new MainThreadServerContext();
  let pageElementId: number | undefined;

  // Attach context
  mtsBinding.wasmContext = wasmContext;

  // Helper to create element
  function createServerElement(tagName: string): ElementHandle {
    const uniqueId = wasmContext.create_element(tagName);
    return { [uniqueIdSymbol]: uniqueId };
  }

  return {
    // Pure/Throwing Methods
    __GetID,
    __GetTag,
    __GetAttributes,
    __GetAttributeByName,
    __GetClasses,
    __GetParent,
    __GetChildren,
    __AddEvent,
    __GetEvent,
    __GetEvents,
    __SetEvents,
    __UpdateListCallbacks,
    __GetConfig,
    __SetConfig,
    __GetElementConfig,
    __GetComponentID,
    __GetDataset,
    __SetDataset,
    __AddDataset,
    __GetDataByKey,
    __ElementIsEqual,
    __GetElementUniqueID,
    __FirstElement,
    __LastElement,
    __NextElement,
    __RemoveElement,
    __ReplaceElement,
    __SwapElement,
    __SetCSSId,
    __AddConfig,
    __UpdateComponentInfo,
    __UpdateComponentID,
    __MarkTemplateElement,
    __MarkPartElement,
    __GetTemplateParts,
    __GetPageElement,
    __InsertElementBefore,
    __ReplaceElements,

    // Context-Dependent Methods
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
      wasmContext.set_attribute(getUniqueId(el), 'text', text);
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
      const id = getUniqueId(el);
      // TODO: Handle componentID/cssID if needed by server context
      if (entryName) {
        wasmContext.set_attribute(
          id,
          'lynx-entry-name',
          entryName,
        );
      }
      if (name) {
        wasmContext.set_attribute(id, 'name', name);
      }
      return el as unknown as DecoratedHTMLElement;
    },
    __CreateWrapperElement(_parentComponentUniqueId: number) {
      return createServerElement(
        'lynx-wrapper',
      ) as unknown as DecoratedHTMLElement;
    },
    __CreateList(_parentComponentUniqueId: number) {
      const el = createServerElement('x-list');
      return el as unknown as DecoratedHTMLElement;
    },
    __CreatePage(_componentID: string, _cssID: number) {
      const el = createServerElement('div');
      const id = getUniqueId(el);
      pageElementId = id;
      wasmContext.set_attribute(id, 'part', 'page');
      return el as unknown as DecoratedHTMLElement;
    },

    __AppendElement(parent: unknown, child: unknown) {
      const parentId = getUniqueId(parent);
      const childId = getUniqueId(child);
      wasmContext.append_child(parentId, childId);
    },

    __SetAttribute(
      element: unknown,
      name: string,
      value: string | boolean | null | undefined | UpdateListInfoAttributeValue,
    ) {
      const id = getUniqueId(element);
      if (value == null) {
        wasmContext.set_attribute(id, name, '');
      } else {
        const valStr = value.toString();
        wasmContext.set_attribute(id, name, valStr);
      }
    },

    __SetClasses(element: unknown, classname: string | null) {
      const id = getUniqueId(element);
      if (classname) {
        wasmContext.set_attribute(id, 'class', classname);
      } else {
        wasmContext.set_attribute(id, 'class', '');
      }
    },

    __AddClass(element: unknown, className: string) {
      const id = getUniqueId(element);
      wasmContext.add_class(id, className);
    },

    __SetInlineStyles(
      element: unknown,
      value: string | Record<string, string> | undefined,
    ) {
      const id = getUniqueId(element);
      if (typeof value === 'string') {
        wasmContext.set_attribute(id, 'style', value);
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([k, v]) => {
          const val = v as string;
          wasmContext.set_style(id, k, val);
        });
      }
    },

    __AddInlineStyle(
      element: unknown,
      key: string | number,
      value: string | number | null | undefined,
    ) {
      const id = getUniqueId(element);
      const keyStr = key.toString();
      const valStr = value?.toString() ?? '';
      wasmContext.set_style(id, keyStr, valStr);
    },

    __FlushElementTree() {
      if (pageElementId !== undefined) {
        const html = wasmContext.generate_html_segment(pageElementId);
        mtsBinding.ssrResult = html;
      }
    },

    __SetID(element: unknown, id: string | null) {
      const elemId = getUniqueId(element);
      if (id) {
        wasmContext.set_attribute(elemId, 'id', id);
      } else {
        wasmContext.set_attribute(elemId, 'id', '');
      }
    },
  };
}
