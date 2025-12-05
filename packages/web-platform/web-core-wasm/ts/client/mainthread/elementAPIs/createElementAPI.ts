import {
  // LynxElement,
  MainThreadWasmContext,
  templateManager,
} from '../wasm.js';
import {
  lynxDisposedAttribute,
  lynxDefaultDisplayLinearAttribute,
  lynxEntryNameAttribute,
  lynxTagAttribute,
  uniqueIdSymbol,
  defaultTagMap,
} from '@constants';
import {
  __SwapElement,
  __AppendElement,
  __ElementIsEqual,
  __FirstElement,
  __GetChildren,
  __GetParent,
  __InsertElementBefore,
  __LastElement,
  __NextElement,
  __RemoveElement,
  __ReplaceElement,
  __ReplaceElements,
  __GetAttributes,
  __GetAttributeByName,
  __GetID,
  __SetID,
  __GetTag,
  __GetClasses,
  __SetClasses,
  __AddClass,
  __MarkTemplateElement,
  __MarkPartElement,
  __GetElementUniqueID,
  __GetTemplateParts,
  __UpdateListCallbacks,
} from './pureElementPAPIs.js';
import { type MainThreadJSBinding } from '../mtsBinding.js';
import type {
  DecoratedHTMLElement,
  ElementPAPIs,
  UpdateListInfoAttributeValue,
} from '@types';

export function createElementAPI(
  entry_template_url: string,
  rootDom: Node,
  mtsBinding: MainThreadJSBinding,
  config_enable_css_selector: boolean,
  config_default_display_linear: boolean,
  config_default_overflow_visible: boolean,
): ElementPAPIs {
  // let uniqueIdCounter = 1;
  const wasmContext = new MainThreadWasmContext(
    rootDom,
    mtsBinding,
    uniqueIdSymbol,
    config_enable_css_selector,
  );
  let page: DecoratedHTMLElement | undefined = undefined;
  mtsBinding.setMainThreadInstance(wasmContext);
  return {
    __CreateView(parentComponentUniqueId: number) {
      const dom = document.createElement('x-view') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      dom.setAttribute(lynxTagAttribute, 'view');
      return dom;
    },
    __CreateText(parentComponentUniqueId) {
      const dom = document.createElement('x-text') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      dom.setAttribute(lynxTagAttribute, 'text');
      return dom;
    },
    __CreateImage(parentComponentUniqueId) {
      const dom = document.createElement('x-image') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      dom.setAttribute(lynxTagAttribute, 'image');
      return dom;
    },
    __CreateRawText(text) {
      const dom = document.createElement('raw-text') as DecoratedHTMLElement;
      dom.setAttribute('text', text);
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(-1, dom);
      dom.setAttribute(lynxTagAttribute, 'raw-text');
      return dom;
    },
    __CreateScrollView(parentComponentUniqueId) {
      const dom = document.createElement('scroll-view') as DecoratedHTMLElement;

      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      dom.setAttribute(lynxTagAttribute, 'scroll-view');
      return dom;
    },
    __CreateElement(tagName, parentComponentUniqueId) {
      const dom = document.createElement(
        defaultTagMap[tagName] ?? tagName,
      ) as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      dom.setAttribute(lynxTagAttribute, tagName);
      return dom;
    },
    __CreateComponent(
      parentComponentUniqueId,
      componentID,
      cssID,
      entryName,
      name,
    ) {
      const dom = document.createElement('x-view') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
        cssID,
        componentID,
      );
      if (entryName) {
        dom.setAttribute(lynxEntryNameAttribute, entryName);
      }
      if (name) {
        dom.setAttribute('name', name);
      }

      return dom;
    },
    __CreateWrapperElement(parentComponentUniqueId) {
      const dom = document.createElement(
        'lynx-wrapper',
      ) as DecoratedHTMLElement;
      dom.setAttribute(lynxTagAttribute, 'wrapper');
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      return dom;
    },
    __CreateList(parentComponentUniqueId, componentAtIndex, enqueueComponent) {
      const dom = document.createElement('x-list') as DecoratedHTMLElement;
      dom.componentAtIndex = componentAtIndex;
      dom.enqueueComponent = enqueueComponent;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      dom.setAttribute(lynxTagAttribute, 'list');
      return dom;
    },
    __CreatePage(componentID, cssID) {
      if (page) return page;
      const dom = document.createElement(
        'div',
      ) as HTMLElement as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        0,
        dom,
        cssID,
        componentID,
      );
      if (config_default_overflow_visible) {
        dom.setAttribute(lynxDefaultDisplayLinearAttribute, 'true');
      }
      if (!config_default_display_linear) {
        dom.setAttribute(lynxDefaultDisplayLinearAttribute, 'false');
      }
      dom.setAttribute(lynxTagAttribute, 'page');
      page = dom;
      return dom;
    },
    __ElementFromBinary(templateId, parentComponentUniqueId) {
      let template_root = wasmContext._wasm_elementFromBinary(
        parentComponentUniqueId,
        entry_template_url,
        templateId,
        templateManager,
      ) as HTMLElement;
      __MarkTemplateElement(template_root);
      return template_root;
    },
    __SetClasses: config_enable_css_selector
      ? __SetClasses
      : ((element, classname) => {
        __SetClasses(element, classname);
        // Also sync to wasm side
        const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
        wasmContext.__wasm_update_css_og_style(uniqueId);
      }),
    __SetCSSId(elements, cssId, entryName) {
      const uniqueIds = elements.map(
        (element) => {
          if (entryName) {
            element.setAttribute(lynxEntryNameAttribute, entryName);
          } else {
            element.removeAttribute(lynxEntryNameAttribute);
          }
          return (element as DecoratedHTMLElement)[uniqueIdSymbol];
        },
      );
      if (cssId !== null) {
        wasmContext.__wasm_set_css_id(
          new Uint32Array(uniqueIds),
          cssId,
        );
      }
    },
    __AddInlineStyle: (
      element,
      key,
      value,
    ) => {
      if (typeof value != 'string') {
        value = (value as number).toString();
      }
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      if (typeof key === 'number') {
        return wasmContext.__wasm_AddInlineStyle_number_key(
          uniqueId,
          key,
          value as string | null,
        );
      } else {
        return wasmContext.__wasm_AddInlineStyle_str_key(
          uniqueId,
          key.toString(),
          value as string | null,
        );
      }
    },
    __SetInlineStyles: (
      element,
      value,
    ) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      if (!value) {
        element.removeAttribute('style');
      } else if (typeof value === 'string') {
        return wasmContext.__wasm_SetInlineStyles(
          uniqueId,
          value,
        );
      } else {
        wasmContext.__wasm_SetInlineStyles(
          uniqueId,
          Object.entries(value).map(([k, v]) => `${k}: ${v};`).join(),
        );
      }
    },
    __AddConfig: (element, type, value) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      const config = wasmContext.__GetConfig(uniqueId);
      // @ts-expect-error
      config[type] = value;
    },
    __UpdateComponentInfo: (element, componentInfo) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      const { componentID, cssID, entry, name } = componentInfo;
      wasmContext.__UpdateComponentInfo(
        uniqueId,
        componentID,
        name,
        entry,
        cssID,
      );
    },
    __UpdateComponentID: (element, componentID) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      wasmContext.__UpdateComponentID(uniqueId, componentID);
    },
    __GetConfig: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.__GetConfig(uniqueId) as any;
    },
    __SetConfig: (element, config) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      wasmContext.__SetConfig(uniqueId, config);
    },
    __GetElementConfig: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.__GetElementConfig(uniqueId) as any;
    },
    __GetComponentID: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.__GetComponentID(uniqueId);
    },
    __SetDataset: (element, dataset) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      wasmContext.__SetDataset(uniqueId, dataset);
    },
    __AddDataset: (element, key, value) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      if (value) {
        element.setAttribute(
          `data-${key}`,
          typeof value === 'object' ? JSON.stringify(value) : value.toString(),
        );
      } else {
        element.removeAttribute(`data-${key}`);
      }
      wasmContext.__AddDataset(uniqueId, key, value);
    },
    __GetDataset: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return Object.assign(
        Object.create(null),
        wasmContext.__GetDataset(uniqueId) as any,
      );
    },
    __GetDataByKey: (element, key) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.__GetDataByKey(uniqueId, key);
    },
    __SetAttribute(element, name, value) {
      if (name === 'update-list-info') {
        const { insertAction, removeAction } =
          value as UpdateListInfoAttributeValue;
        queueMicrotask(() => {
          const componentAtIndex =
            (element as DecoratedHTMLElement).componentAtIndex;
          const enqueueComponent =
            (element as DecoratedHTMLElement).enqueueComponent;
          const uniqueId = __GetElementUniqueID(element);
          for (const action of insertAction) {
            componentAtIndex?.(
              element,
              uniqueId,
              action.position,
              0,
              false,
            );
          }
          for (const action of removeAction) {
            enqueueComponent?.(element, uniqueId, action.position);
          }
        });
      } else {
        if (value == null) {
          element.removeAttribute(name);
        } else {
          element.setAttribute(name, value.toString());
        }
      }
    },
    __AddEvent: (
      element,
      eventType,
      eventName,
      frameworkCrossThreadIdentifier,
    ) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      wasmContext.__AddEvent(
        uniqueId,
        eventType,
        eventName,
        frameworkCrossThreadIdentifier,
      );
    },
    __GetEvent: (element, eventType, eventName) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.__GetEvent(uniqueId, eventType, eventName);
    },
    __GetEvents: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.__GetEvents(uniqueId) as any;
    },
    __SetEvents: (element, events) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      for (const event of events) {
        wasmContext.__AddEvent(
          uniqueId,
          event.type,
          event.name,
          event.function,
        );
      }
    },
    __GetPageElement: () => page,
    __AppendElement,
    __ElementIsEqual,
    __FirstElement,
    __GetChildren,
    __GetParent,
    __InsertElementBefore,
    __LastElement,
    __NextElement,
    __RemoveElement,
    __ReplaceElement,
    __GetAttributes,
    __GetAttributeByName,
    __ReplaceElements,
    __GetID,
    __SetID,
    __GetTag,
    __AddClass,
    __GetClasses,
    __MarkTemplateElement,
    __MarkPartElement,
    __GetTemplateParts,
    __GetElementUniqueID,
    __UpdateListCallbacks,
    __SwapElement,
    __FlushElementTree: () => {
      if (
        page && !page.parentNode
        && page.getAttribute(lynxDisposedAttribute) !== ''
      ) {
        // @ts-expect-error
        rootDom.append(page);
      }
    },
  };
}
