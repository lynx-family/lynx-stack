import {
  // LynxElement,
  MainThreadGlobalThis,
  TemplateManager,
} from '../dist/standard.js';
import {
  lynxDisposedAttribute,
  cssIdAttribute,
  lynxDefaultDisplayLinearAttribute,
  lynxEntryNameAttribute,
  lynxTagAttribute,
  lynxUniqueIdAttribute,
  uniqueIdSymbol,
  type ComponentAtIndexCallback,
  type DecoratedHTMLElement,
  type EnqueueComponentCallback,
  type UpdateListInfoAttributeValue,
  type ElementPAPIs,
} from '@lynx-js/web-constants';
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

export const templateManager = new TemplateManager();

export function createMtsGlobalThis(
  rootDom: Node,
  mts_realm: any,
  mts_binding: any,
  bts_rpc: any,
  config_enable_css_selector: boolean,
  config_enable_remove_css_scope: boolean,
  config_default_display_linear: boolean,
  config_default_overflow_visible: boolean,
): ElementPAPIs {
  // let uniqueIdCounter = 1;
  const wasmContext = new MainThreadGlobalThis(
    rootDom,
    mts_realm,
    mts_binding,
    bts_rpc,
    config_enable_css_selector,
    config_enable_remove_css_scope,
    config_default_display_linear,
    config_default_overflow_visible,
  );
  // mtsGlobalThis.__CreateView = (parent_component_uniqueId) => createElementCommon('x-view', parent_component_uniqueId);
  let page: DecoratedHTMLElement | undefined = undefined;
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
      const dom = document.createElement(tagName) as DecoratedHTMLElement;
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
        wasmContext.__wasm_update_css_id(
          new Int32Array(uniqueIds),
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
      wasmContext.__AddConfig(uniqueId, type, value);
    },
    __UpdateComponentInfo: (element, componentInfo) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      wasmContext.__UpdateComponentInfo(uniqueId, componentInfo);
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
  // return {
  // __ElementFromBinary: mtsGlobalThis.__ElementFromBinary.bind(
  //   mtsGlobalThis,
  // ),
  // __GetTemplateParts: mtsGlobalThis.__GetTemplateParts.bind(mtsGlobalThis),
  // __MarkTemplateElement: mtsGlobalThis.__MarkTemplateElement.bind(
  //   mtsGlobalThis,
  // ),
  // __MarkPartElement: mtsGlobalThis.__MarkPartElement.bind(mtsGlobalThis),
  // __AddEvent: mtsGlobalThis.__AddEvent.bind(mtsGlobalThis),
  // __GetEvent: mtsGlobalThis.__GetEvent.bind(mtsGlobalThis),
  // __GetEvents: mtsGlobalThis.__GetEvents.bind(mtsGlobalThis),
  // __SetEvents: mtsGlobalThis.__SetEvents.bind(mtsGlobalThis),
  // __AppendElement: mtsGlobalThis.__AppendElement.bind(mtsGlobalThis),
  // __ElementIsEqual: (a, b) => {
  //   if (a instanceof LynxElement && b instanceof LynxElement) {
  //     return mtsGlobalThis.__wasm_ElementIsEqual(a, b);
  //   }
  //   return false;
  // },
  // __FirstElement: mtsGlobalThis.__FirstElement.bind(mtsGlobalThis),
  // __GetChildren: mtsGlobalThis.__GetChildren.bind(mtsGlobalThis),
  // __GetParent: mtsGlobalThis.__GetParent.bind(mtsGlobalThis),
  // __InsertElementBefore: mtsGlobalThis.__InsertElementBefore.bind(
  //   mtsGlobalThis,
  // ),
  // __LastElement: mtsGlobalThis.__LastElement.bind(mtsGlobalThis),
  // __NextElement: mtsGlobalThis.__NextElement.bind(mtsGlobalThis),
  // __RemoveElement: mtsGlobalThis.__RemoveElement.bind(mtsGlobalThis),
  // __ReplaceElement: mtsGlobalThis.__ReplaceElement.bind(mtsGlobalThis),
  // __ReplaceElements: mtsGlobalThis.__ReplaceElements.bind(mtsGlobalThis),
  // __AddConfig: mtsGlobalThis.__AddConfig.bind(mtsGlobalThis),
  // __AddDataset: mtsGlobalThis.__AddDataset.bind(mtsGlobalThis),
  // __GetAttributes: mtsGlobalThis.__GetAttributes.bind(mtsGlobalThis),
  // __GetComponentID: mtsGlobalThis.__GetComponentID.bind(mtsGlobalThis),
  // __GetDataByKey: mtsGlobalThis.__GetDataByKey.bind(mtsGlobalThis),
  // __GetDataset: mtsGlobalThis.__GetDataset.bind(mtsGlobalThis),
  // __GetElementConfig: mtsGlobalThis.__GetElementConfig.bind(mtsGlobalThis),
  // __GetElementUniqueID: (element: unknown) => {
  //   if (element instanceof LynxElement) {
  //     return mtsGlobalThis.__wasm__GetElementUniqueID(element);
  //   }
  //   return -1;
  // },
  // __GetID: mtsGlobalThis.__GetID.bind(mtsGlobalThis),
  // __GetTag: mtsGlobalThis.__GetTag.bind(mtsGlobalThis),
  // __SetConfig: mtsGlobalThis.__SetConfig.bind(mtsGlobalThis),
  // __SetDataset: mtsGlobalThis.__SetDataset.bind(mtsGlobalThis),
  // __SetID: mtsGlobalThis.__SetID.bind(mtsGlobalThis),
  // __UpdateComponentID: mtsGlobalThis.__UpdateComponentID.bind(
  //   mtsGlobalThis,
  // ),
  // __UpdateComponentInfo: mtsGlobalThis.__UpdateComponentInfo.bind(
  //   mtsGlobalThis,
  // ),
  // __CreateElement: mtsGlobalThis.__CreateElement.bind(mtsGlobalThis),
  //   __SetAttribute: mtsGlobalThis.__SetAttribute.bind(mtsGlobalThis),
  //   __SwapElement: mtsGlobalThis.__SwapElement.bind(mtsGlobalThis),
  //   __UpdateListCallbacks: mtsGlobalThis.__UpdateListCallbacks.bind(
  //     mtsGlobalThis,
  //   ),
  //   __GetConfig: mtsGlobalThis.__GetConfig.bind(mtsGlobalThis),
  //   __GetAttributeByName: mtsGlobalThis.__GetAttributeByName.bind(
  //     mtsGlobalThis,
  //   ),
  //   __GetClasses: mtsGlobalThis.__GetClasses.bind(mtsGlobalThis),
  //   __AddClass: mtsGlobalThis.__AddClass.bind(mtsGlobalThis),
  //   __SetClasses: mtsGlobalThis.__SetClasses.bind(mtsGlobalThis),
  //   __AddInlineStyle: (
  //     element: LynxElement,
  //     key: string | number,
  //     value: string | number | null | undefined,
  //   ) => {
  //     if (typeof value === 'number') {
  //       value = (value as number).toString();
  //     }
  //     if (typeof key === 'number') {
  //       return mtsGlobalThis.__wasm_AddInlineStyle_number_key(
  //         element,
  //         key,
  //         value as string | null,
  //       );
  //     } else {
  //       return mtsGlobalThis.__wasm_AddInlineStyle_str_key(
  //         element,
  //         key.toString(),
  //         value as string | null,
  //       );
  //     }
  //   },
  //   __SetCSSId: mtsGlobalThis.__SetCSSId.bind(mtsGlobalThis),
  //   __SetInlineStyles: (
  //     element: LynxElement,
  //     value: string | Record<string, string | number> | undefined,
  //   ) => {
  //     if (typeof value === 'string') {
  //       return mtsGlobalThis.__wasm_SetInlineStyles(
  //         element,
  //         value,
  //       );
  //     } else {
  //       // Clear all inline styles
  //       mtsGlobalThis.__wasm_SetInlineStyles(
  //         element,
  //         '',
  //       );
  //       if (value) {
  //         for (const [key, val] of Object.entries(value)) {
  //           if (val !== null) {
  //             mtsGlobalThis.__wasm_AddInlineStyle_str_key(
  //               element,
  //               key,
  //               val.toString(),
  //             );
  //           }
  //         }
  //       }
  //     }
  //   },
  //   __FlushElementTree: mtsGlobalThis.__FlushElementTree.bind(mtsGlobalThis),
  //   // __LoadLepusChunk: mtsGlobalThis.__LoadLepusChunk.bind(mtsGlobalThis),
  //   __Getpage: mtsGlobalThis.__Getpage.bind(mtsGlobalThis),
  //   __QueryComponent: (
  //     url,
  //     resultCallback,
  //   ) => {
  //     try {
  //       const result = mtsGlobalThis.__wasm_queryComponent(
  //         url,
  //         templateManager,
  //       );
  //       resultCallback?.({
  //         code: 0,
  //         data: {
  //           url,
  //           evalResult: result,
  //         },
  //       });
  //     } catch (e) {
  //       console.error(`lynx web: lazy bundle load failed:`, e);
  //       resultCallback?.({
  //         code: -1,
  //         data: undefined,
  //       });
  //     }
  //     return null;
  //   },
  // };
}
