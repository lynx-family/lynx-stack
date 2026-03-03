/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MainThreadServerContext, StyleSheetResource } from '../wasm.js';

import {
  LYNX_TAG_TO_HTML_TAG_MAP,
  uniqueIdSymbol,
  lynxDefaultDisplayLinearAttribute,
  lynxEntryNameAttribute,
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

export function createElementAPI(
  mtsBinding: SSRBinding,
  styleInfo: Uint8Array | undefined,
  viewAttributes: string,
  config: {
    enableCSSSelector: boolean;
    defaultOverflowVisible: boolean;
    defaultDisplayLinear: boolean;
  },
): { globalThisAPIs: ElementPAPIs; wasmContext: MainThreadServerContext } {
  const wasmContext = new MainThreadServerContext(
    viewAttributes,
    config.enableCSSSelector,
  );
  if (styleInfo) {
    const resource = new StyleSheetResource(styleInfo, undefined);
    wasmContext.push_style_sheet(resource);
  }

  let pageElementId: number | undefined;

  function getAttribute(
    element: ServerElement,
    key: string,
  ): string | undefined {
    return wasmContext.get_attribute(element[uniqueIdSymbol], key) || undefined;
  }

  const __SetCSSId: SetCSSIdPAPI = (
    elements: HTMLElement[],
    cssId: number | null,
    entryName?: string,
  ) => {
    const uniqueIds = elements.map(
      (element) => (element as ServerElement)[uniqueIdSymbol],
    );
    wasmContext.set_css_id(new Uint32Array(uniqueIds), cssId ?? 0, entryName);
  };

  const __SetClasses: SetClassesPAPI = (
    element: HTMLElement,
    classname: string | null,
  ) => {
    const el = element as ServerElement;
    if (classname) {
      wasmContext.set_attribute(el[uniqueIdSymbol], 'class', classname);
    } else {
      wasmContext.remove_attribute(el[uniqueIdSymbol], 'class');
    }
  };

  const __AddClass: AddClassPAPI = (
    element: HTMLElement,
    className: string,
  ) => {
    const el = element as ServerElement;
    wasmContext.add_class(el[uniqueIdSymbol], className);
  };

  return {
    globalThisAPIs: {
      // Pure/Throwing Methods
      __GetID: ((element: HTMLElement) => {
        return getAttribute(element as ServerElement, 'id') ?? null;
      }) as GetIDPAPI,
      __GetTag: ((element: HTMLElement) => {
        const el = element as ServerElement;
        const tag = wasmContext.get_tag(el[uniqueIdSymbol]) ?? '';
        // Reverse-map HTML tag to Lynx tag (consistent with CSR `__GetTag` behavior)
        for (
          const [lynxTag, htmlTag] of Object.entries(LYNX_TAG_TO_HTML_TAG_MAP)
        ) {
          if (tag === htmlTag) {
            return lynxTag;
          }
        }
        return tag;
      }) as GetTagPAPI,
      __GetAttributes: ((element: HTMLElement) => {
        const el = element as ServerElement;
        return wasmContext.get_attributes(el[uniqueIdSymbol]);
      }) as GetAttributesPAPI,
      __GetAttributeByName: (element: unknown, name: string) => {
        return getAttribute(element as ServerElement, name) ?? null;
      },
      __GetClasses: ((element: HTMLElement) => {
        const cls = getAttribute(element as ServerElement, 'class');
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

      __SetCSSId,
      __SetClasses: config.enableCSSSelector
        ? __SetClasses
        : ((element, classname) => {
          __SetClasses(element, classname);
          const el = element as ServerElement;
          wasmContext.update_css_og_style(
            el[uniqueIdSymbol],
            getAttribute(el, lynxEntryNameAttribute),
          );
        }),
      __AddClass,

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
      __CreateView: ((parentComponentUniqueId: number) => {
        const id = wasmContext.create_element(
          'x-view',
          parentComponentUniqueId,
        );
        return { [uniqueIdSymbol]: id } as unknown as DecoratedHTMLElement;
      }) as CreateViewPAPI,
      __CreateText: ((parentComponentUniqueId: number) => {
        const id = wasmContext.create_element(
          'x-text',
          parentComponentUniqueId,
        );
        return { [uniqueIdSymbol]: id } as unknown as DecoratedHTMLElement;
      }) as CreateTextPAPI,
      __CreateImage: ((parentComponentUniqueId: number) => {
        const id = wasmContext.create_element(
          'x-image',
          parentComponentUniqueId,
        );
        return { [uniqueIdSymbol]: id } as unknown as DecoratedHTMLElement;
      }) as CreateImagePAPI,
      __CreateRawText: ((text: string) => {
        const id = wasmContext.create_element('raw-text');
        wasmContext.set_attribute(id, 'text', text);
        return { [uniqueIdSymbol]: id } as unknown as DecoratedHTMLElement;
      }) as CreateRawTextPAPI,
      __CreateScrollView: ((parentComponentUniqueId: number) => {
        const id = wasmContext.create_element(
          'scroll-view',
          parentComponentUniqueId,
        );
        return { [uniqueIdSymbol]: id } as unknown as DecoratedHTMLElement;
      }) as CreateScrollViewPAPI,
      __CreateElement: ((tagName: string, parentComponentUniqueId: number) => {
        const htmlTag = LYNX_TAG_TO_HTML_TAG_MAP[tagName] ?? tagName;
        const id = wasmContext.create_element(htmlTag, parentComponentUniqueId);
        const el = { [uniqueIdSymbol]: id };
        if (!config.enableCSSSelector) {
          wasmContext.set_attribute(id, 'l-uid', id.toString());
        }
        return el as unknown as DecoratedHTMLElement;
      }) as CreateElementPAPI,
      __CreateComponent: ((
        parentComponentUniqueId: number,
        _componentID: string,
        _cssID: number,
        entryName: string,
        name: string,
      ) => {
        const id = wasmContext.create_element(
          'x-view',
          parentComponentUniqueId,
          _cssID,
          _componentID,
        ); // Component host
        const el = { [uniqueIdSymbol]: id } as ServerElement;
        if (!config.enableCSSSelector) {
          wasmContext.set_attribute(id, 'l-uid', id.toString());
        }
        if (entryName) {
          wasmContext.set_attribute(id, 'lynx-entry-name', entryName);
        }
        if (name) {
          wasmContext.set_attribute(id, 'name', name);
        }
        return el as unknown as DecoratedHTMLElement;
      }) as CreateComponentPAPI,
      __CreateWrapperElement: ((parentComponentUniqueId: number) => {
        const id = wasmContext.create_element(
          'lynx-wrapper',
          parentComponentUniqueId,
        );
        return { [uniqueIdSymbol]: id } as unknown as DecoratedHTMLElement;
      }) as CreateWrapperElementPAPI,
      __CreateList: ((parentComponentUniqueId: number) => {
        const id = wasmContext.create_element(
          'x-list',
          parentComponentUniqueId,
        );
        return { [uniqueIdSymbol]: id } as unknown as DecoratedHTMLElement;
      }) as CreateListPAPI,
      __CreatePage: ((_componentID: string, _cssID: number) => {
        const id = wasmContext.create_element(
          'div',
          0,
          _cssID,
          _componentID,
        );
        pageElementId = id;
        const el = { [uniqueIdSymbol]: id } as ServerElement;
        if (!config.enableCSSSelector) {
          wasmContext.set_attribute(id, 'l-uid', id.toString());
        }
        wasmContext.set_attribute(id, 'part', 'page');

        if (config.defaultDisplayLinear === false) {
          wasmContext.set_attribute(
            id,
            lynxDefaultDisplayLinearAttribute,
            'false',
          );
        }
        if (config.defaultOverflowVisible === true) {
          wasmContext.set_attribute(
            id,
            'lynx-default-overflow-visible',
            'true',
          );
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
        value:
          | string
          | boolean
          | null
          | undefined
          | UpdateListInfoAttributeValue,
      ) => {
        const el = element as ServerElement;
        let valStr = '';
        if (value == null) {
          valStr = '';
        } else {
          valStr = value.toString();
        }
        wasmContext.set_attribute(el[uniqueIdSymbol], name, valStr);
      }) as SetAttributePAPI & SetAttributePAPIUpdateListInfo,

      __SetInlineStyles: ((
        element: HTMLElement,
        value: string | Record<string, string> | undefined,
      ) => {
        const uniqueId = (element as ServerElement)[uniqueIdSymbol];
        if (!value) {
          wasmContext.remove_attribute(uniqueId, 'style');
        } else {
          if (typeof value === 'string') {
            if (
              !wasmContext.set_inline_styles_in_str(
                uniqueId,
                value,
              )
            ) {
              wasmContext.set_attribute(uniqueId, 'style', value);
            }
          } else if (!value) {
            wasmContext.remove_attribute(uniqueId, 'style');
          } else {
            wasmContext.get_inline_styles_in_key_value_vec(
              uniqueId,
              Object.entries(value).flat().map((item) => item.toString()),
            );
          }
        }
      }) as SetInlineStylesPAPI,

      __AddInlineStyle: ((
        element: HTMLElement,
        key: string | number,
        value: string | number | null | undefined,
      ) => {
        const uniqueId = (element as ServerElement)[uniqueIdSymbol];
        if (typeof value != 'string') {
          value = (value as number).toString();
        }
        if (typeof key === 'number') {
          return wasmContext.set_inline_styles_number_key(
            uniqueId,
            key,
            value as string | null,
          );
        } else {
          return wasmContext.add_inline_style_raw_string_key(
            uniqueId,
            key.toString(),
            value as string | null,
          );
        }
      }) as AddInlineStylePAPI,

      __FlushElementTree: (() => {
        if (pageElementId !== undefined) {
          mtsBinding.ssrResult = wasmContext.generate_html(pageElementId);
        }
      }),

      __SetID: ((element: HTMLElement, id: string | null) => {
        wasmContext.set_attribute(
          (element as ServerElement)[uniqueIdSymbol],
          'id',
          id ?? '',
        );
      }) as SetIDPAPI,
    },
    wasmContext,
  };
}
