/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MainThreadServerContext, StyleSheetResource } from '../wasm.js';
import {
  templateFilterImage,
  templateInlineImage,
  templateScrollView,
  templateXAudioTT,
  templateXImage,
  templateXInput,
  templateXList,
  templateXOverlayNg,
  templateXRefreshView,
  templateXSvg,
  templateXSwiper,
  templateXText,
  templateXTextarea,
  templateXViewpageNg,
  templateXWebView,
} from '@lynx-js/web-elements/html-templates';
import {
  LYNX_TAG_TO_HTML_TAG_MAP,
  uniqueIdSymbol,
  cssIdAttribute,
  lynxEntryNameAttribute,
  lynxDefaultDisplayLinearAttribute,
} from '../../constants.js';
import type {
  AddClassPAPI,
  AddInlineStylePAPI,
  AppendElementPAPI,
  CreateComponentPAPI,
  CreateElementPAPI,
  CreateImagePAPI,
  CreateListPAPI,
  CreatePagePAPI,
  CreateRawTextPAPI,
  CreateScrollViewPAPI,
  CreateTextPAPI,
  CreateViewPAPI,
  CreateWrapperElementPAPI,
  DecoratedHTMLElement,
  ElementPAPIs,
  GetAttributesPAPI,
  GetClassesPAPI,
  GetIDPAPI,
  GetTagPAPI,
  SetAttributePAPI,
  SetAttributePAPIUpdateListInfo,
  SetCSSIdPAPI,
  SetClassesPAPI,
  SetIDPAPI,
  SetInlineStylesPAPI,
  UpdateListInfoAttributeValue,
} from '../../types/index.js';
import {
  __AddConfig,
  __AddDataset,
  __AddEvent,
  __ElementIsEqual,
  __FirstElement,
  __GetChildren,
  __GetComponentID,
  __GetConfig,
  __GetDataByKey,
  __GetDataset,
  __GetElementConfig,
  __GetElementUniqueID,
  __GetEvent,
  __GetEvents,
  __GetPageElement,
  __GetParent,
  __GetTemplateParts,
  __InsertElementBefore,
  __LastElement,
  __MarkPartElement,
  __MarkTemplateElement,
  __NextElement,
  __RemoveElement,
  __ReplaceElement,
  __ReplaceElements,
  __SetConfig,
  __SetDataset,
  __SetEvents,
  __SwapElement,
  __UpdateComponentID,
  __UpdateComponentInfo,
  __UpdateListCallbacks,
  getUniqueId,
  type ServerElement,
} from './pureElementAPIs.js';

export type SSRBinding = {
  ssrResult: string;
};

// Internal strict cast
function getServerElement(element: unknown): ServerElement {
  return element as ServerElement;
}

export function createElementAPI(
  mtsBinding: SSRBinding,
  config: {
    enableCSSSelector: boolean;
    defaultOverflowVisible: boolean;
    defaultDisplayLinear: boolean;
    viewAttributes?: string;
  },
  styleInfo?: Uint8Array,
): ElementPAPIs {
  const wasmContext = new MainThreadServerContext({
    'scroll-view': templateScrollView,
    'x-audio-tt': templateXAudioTT,
    'x-image': templateXImage,
    'filter-image': templateFilterImage,
    'inline-image': templateInlineImage,
    'x-input': templateXInput,
    'x-list': templateXList,
    'x-overlay-ng': templateXOverlayNg,
    'x-refresh-view': templateXRefreshView,
    'x-svg': templateXSvg,
    'x-swiper': templateXSwiper,
    'x-text': templateXText,
    'x-textarea': templateXTextarea,
    'x-viewpager-ng': templateXViewpageNg,
    'x-web-view': templateXWebView,
  }, config.viewAttributes ?? '');
  if (styleInfo) {
    const resource = new StyleSheetResource(styleInfo, undefined);
    wasmContext.push_style_sheet(resource);
  }
  (mtsBinding as any).wasmContext = wasmContext;

  let pageElementId: number | undefined;

  // Helper to create element
  function createServerElement(tagName: string): ServerElement {
    const uniqueId = wasmContext.create_element(tagName);
    const element: ServerElement = {
      [uniqueIdSymbol]: uniqueId,
      attributes: {},
      tagName,
    };
    if (!config.enableCSSSelector) {
      setAttributeInternal(element, 'l-uid', uniqueId.toString());
    }
    return element;
  }

  // Optimized: Direct access without redundant getUniqueId call if we already have the element
  function setAttributeInternal(el: ServerElement, key: string, value: string) {
    el.attributes[key] = value;
    wasmContext.set_attribute(el[uniqueIdSymbol], key, value);
  }

  function getAttributeInternal(
    el: ServerElement,
    key: string,
  ): string | undefined {
    return el.attributes[key];
  }

  // Wrapper for external calls where we only have unknown/HTMLElement
  function setAttribute(element: unknown, key: string, value: string) {
    setAttributeInternal(getServerElement(element), key, value);
  }

  function getAttribute(element: unknown, key: string): string | undefined {
    return getAttributeInternal(getServerElement(element), key);
  }

  // --- CSSOG Implementations ---
  const __SetCSSIdForCSSOG: SetCSSIdPAPI = (
    elements: HTMLElement[],
    cssId: number | null,
    entryName?: string,
  ) => {
    for (const element of elements) {
      const el = getServerElement(element);
      if (cssId !== 0) {
        setAttributeInternal(
          el,
          cssIdAttribute,
          cssId === null ? '' : String(cssId),
        );
      }
      if (entryName) {
        setAttributeInternal(el, lynxEntryNameAttribute, entryName);
      }
      const cls = getAttributeInternal(el, 'class');
      if (cls) {
        __SetClassesForCSSOG(element, cls);
      }
    }
  };

  const __SetClassesForCSSOG: SetClassesPAPI = (
    element: HTMLElement,
    classNames: string | null,
  ) => {
    const el = getServerElement(element);

    // Inline __SetClasses logic to avoid redundant lookups
    const clsVal = classNames || '';
    setAttributeInternal(el, 'class', clsVal);

    const cssId = getAttributeInternal(el, cssIdAttribute);
    const entryName = getAttributeInternal(el, lynxEntryNameAttribute);

    // Direct WASM call with cached values
    wasmContext.update_css_og_style(
      el[uniqueIdSymbol],
      Number(cssId) || 0,
      clsVal.split(/\s+/),
      entryName,
    );
  };

  const __AddClassForCSSOG: AddClassPAPI = (
    element: HTMLElement,
    className: string,
  ) => {
    const el = getServerElement(element);
    const oldClass = getAttributeInternal(el, 'class') ?? '';
    const newClassName = (oldClass + ' ' + className).trim();
    setAttributeInternal(el, 'class', newClassName);

    const cssId = getAttributeInternal(el, cssIdAttribute);
    const entryName = getAttributeInternal(el, lynxEntryNameAttribute);

    wasmContext.update_css_og_style(
      el[uniqueIdSymbol],
      Number(cssId) || 0,
      newClassName.split(/\s+/),
      entryName,
    );
  };

  const __SetCSSId: SetCSSIdPAPI = (
    elements: HTMLElement[],
    cssId: number | null,
    entryName?: string,
  ) => {
    for (const element of elements) {
      if (cssId === 0) {
        // Skip setting cssIdAttribute for 0 to match CSR behavior
        continue;
      }
      const el = getServerElement(element);
      setAttributeInternal(
        el,
        cssIdAttribute,
        cssId === null ? '' : String(cssId),
      );
      if (entryName) {
        setAttributeInternal(el, lynxEntryNameAttribute, entryName);
      }
    }
  };

  const __SetClasses: SetClassesPAPI = (
    element: HTMLElement,
    classname: string | null,
  ) => {
    setAttribute(element, 'class', classname || '');
  };

  const __AddClass: AddClassPAPI = (
    element: HTMLElement,
    className: string,
  ) => {
    const el = getServerElement(element);
    wasmContext.add_class(el[uniqueIdSymbol], className);
    // Update local attribute state
    const oldClass = getAttributeInternal(el, 'class') ?? '';
    const newClassName = (oldClass + ' ' + className).trim();
    el.attributes['class'] = newClassName;
  };

  const isCSSOG = !config.enableCSSSelector;

  return {
    // Pure/Throwing Methods
    __GetID: ((element: HTMLElement) => {
      return getAttribute(element, 'id') ?? null;
    }) as GetIDPAPI,
    __GetTag: ((element: HTMLElement) => {
      // Direct access via getServerElement optimized path
      return getServerElement(element).tagName;
    }) as GetTagPAPI,
    __GetAttributes: ((element: HTMLElement) => {
      return { ...getServerElement(element).attributes };
    }) as GetAttributesPAPI,
    __GetAttributeByName: (element: unknown, name: string) => {
      return getAttribute(element, name) ?? null;
    },
    __GetClasses: ((element: HTMLElement) => {
      const cls = getAttribute(element, 'class');
      if (!cls) return [];
      return cls.split(/\s+/).filter((c) => c.length > 0);
    }) as GetClassesPAPI,
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

    __SetCSSId: isCSSOG ? __SetCSSIdForCSSOG : __SetCSSId,
    __SetClasses: isCSSOG ? __SetClassesForCSSOG : __SetClasses,
    __AddClass: isCSSOG ? __AddClassForCSSOG : __AddClass,

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
    // Note: We cast to DecoratedHTMLElement to satisfy the PAPI interface,
    // even though our runtime object is ServerElement.
    __CreateView: ((_parentComponentUniqueId: number) => {
      return createServerElement('x-view') as unknown as DecoratedHTMLElement;
    }) as CreateViewPAPI,
    __CreateText: ((_parentComponentUniqueId: number) => {
      return createServerElement('x-text') as unknown as DecoratedHTMLElement;
    }) as CreateTextPAPI,
    __CreateImage: ((_parentComponentUniqueId: number) => {
      return createServerElement('x-image') as unknown as DecoratedHTMLElement;
    }) as CreateImagePAPI,
    __CreateRawText: ((text: string) => {
      const el = createServerElement('raw-text');
      setAttributeInternal(el, 'text', text);
      return el as unknown as DecoratedHTMLElement;
    }) as CreateRawTextPAPI,
    __CreateScrollView: ((_parentComponentUniqueId: number) => {
      return createServerElement(
        'scroll-view',
      ) as unknown as DecoratedHTMLElement;
    }) as CreateScrollViewPAPI,
    __CreateElement: ((tagName: string, _parentComponentUniqueId: number) => {
      const htmlTag = LYNX_TAG_TO_HTML_TAG_MAP[tagName] ?? tagName;
      return createServerElement(htmlTag) as unknown as DecoratedHTMLElement;
    }) as CreateElementPAPI,
    __CreateComponent: ((
      _parentComponentUniqueId: number,
      _componentID: string,
      _cssID: number,
      entryName: string,
      name: string,
    ) => {
      const el = createServerElement('x-view'); // Component host
      if (entryName) {
        setAttributeInternal(el, 'lynx-entry-name', entryName);
      }
      if (name) {
        setAttributeInternal(el, 'name', name);
      }
      return el as unknown as DecoratedHTMLElement;
    }) as CreateComponentPAPI,
    __CreateWrapperElement: ((_parentComponentUniqueId: number) => {
      return createServerElement(
        'lynx-wrapper',
      ) as unknown as DecoratedHTMLElement;
    }) as CreateWrapperElementPAPI,
    __CreateList: ((_parentComponentUniqueId: number) => {
      return createServerElement('x-list') as unknown as DecoratedHTMLElement;
    }) as CreateListPAPI,
    __CreatePage: ((_componentID: string, _cssID: number) => {
      const el = createServerElement('div');
      pageElementId = el[uniqueIdSymbol];
      setAttributeInternal(el, 'part', 'page');

      if (config.defaultDisplayLinear === false) {
        setAttributeInternal(el, lynxDefaultDisplayLinearAttribute, 'false');
      }
      if (config.defaultOverflowVisible === true) {
        setAttributeInternal(el, 'lynx-default-overflow-visible', 'true');
      }

      return el as unknown as DecoratedHTMLElement;
    }) as CreatePagePAPI,

    __AppendElement: ((parent: HTMLElement, child: HTMLElement) => {
      const parentId = getUniqueId(parent);
      const childId = getUniqueId(child);
      wasmContext.append_child(parentId, childId);
    }) as AppendElementPAPI,

    __SetAttribute: ((
      element: HTMLElement,
      name: string,
      value: string | boolean | null | undefined | UpdateListInfoAttributeValue,
    ) => {
      const el = getServerElement(element);
      let valStr = '';
      if (value == null) {
        valStr = '';
      } else {
        valStr = value.toString();
      }
      setAttributeInternal(el, name, valStr);
    }) as SetAttributePAPI & SetAttributePAPIUpdateListInfo,

    __SetInlineStyles: ((
      element: HTMLElement,
      value: string | Record<string, string> | undefined,
    ) => {
      const el = getServerElement(element);
      const id = el[uniqueIdSymbol];
      if (typeof value === 'string') {
        wasmContext.set_attribute(id, 'style', value);
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([k, v]) => {
          // TODO: This loop can be optimized in WASM side if we had bulk update
          wasmContext.set_style(id, k, v as string);
        });
      }
    }) as SetInlineStylesPAPI,

    __AddInlineStyle: ((
      element: HTMLElement,
      key: string | number,
      value: string | number | null | undefined,
    ) => {
      const el = getServerElement(element);
      const keyStr = key.toString();
      const valStr = value?.toString() ?? '';
      wasmContext.set_style(el[uniqueIdSymbol], keyStr, valStr);
    }) as AddInlineStylePAPI,

    __FlushElementTree: (() => {
      if (pageElementId !== undefined) {
        mtsBinding.ssrResult = wasmContext.generate_html(pageElementId);
      }
    }),

    __SetID: ((element: HTMLElement, id: string | null) => {
      setAttribute(element, 'id', id ?? '');
    }) as SetIDPAPI,
  };
}
