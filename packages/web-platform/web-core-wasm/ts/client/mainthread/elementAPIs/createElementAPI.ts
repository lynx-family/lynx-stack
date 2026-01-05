import { wasmInstance } from '../../wasm.js';
import { templateManager } from '../TemplateManager.js';

import {
  lynxDisposedAttribute,
  lynxDefaultDisplayLinearAttribute,
  lynxEntryNameAttribute,
  uniqueIdSymbol,
  LYNX_TAG_TO_HTML_TAG_MAP,
  cssIdAttribute,
} from '../../../constants.js';
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
import type {
  AddEventPAPI,
  DecoratedHTMLElement,
  ElementPAPIs,
  SetCSSIdPAPI,
  UpdateListInfoAttributeValue,
} from '../../../types/index.js';
import type { WASMJSBinding } from './WASMJSBinding.js';
import hyphenateStyleName from 'hyphenate-style-name';
export function createElementAPI(
  entryTemplateUrl: string,
  rootDom: ShadowRoot,
  mtsBinding: WASMJSBinding,
  config_enable_css_selector: boolean,
  config_default_display_linear: boolean,
  config_default_overflow_visible: boolean,
): ElementPAPIs {
  const wasmContext = new wasmInstance.MainThreadWasmContext(
    document,
    rootDom,
    mtsBinding,
    uniqueIdSymbol,
    config_enable_css_selector,
  );
  mtsBinding.wasmContext = wasmContext;
  let page: DecoratedHTMLElement | undefined = undefined;
  const timingFlags: string[] = [];
  const uniqueIdToElement = mtsBinding.uniqueIdToElement;

  const __SetCSSId: SetCSSIdPAPI = (elements, cssId, entryName) => {
    const uniqueIds = elements.map(
      (element) => {
        if (entryName) {
          element.setAttribute(lynxEntryNameAttribute, entryName);
        } else {
          element.removeAttribute(lynxEntryNameAttribute);
        }
        if (cssId) {
          element.setAttribute(cssIdAttribute, cssId.toString());
        } else {
          element.removeAttribute(cssIdAttribute);
        }
        return (element as DecoratedHTMLElement)[uniqueIdSymbol];
      },
    );
    if (cssId !== null) {
      wasmContext.__wasm_set_css_id(
        new Uint32Array(uniqueIds),
        cssId,
      );
      for (const element of elements) {
        const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
        if (!config_enable_css_selector) {
          mtsBinding.lynxViewInstance.styleManager!.updateCssOgStyle(
            uniqueId,
            cssId,
            element.classList,
            entryName,
          );
        }
      }
    }
  };
  const __AddEvent: AddEventPAPI = (
    element,
    eventType,
    eventName,
    frameworkCrossThreadIdentifier,
  ) => {
    const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
    if (typeof frameworkCrossThreadIdentifier === 'string') {
      wasmContext.__wasm_add_event_bts(
        uniqueId,
        eventType,
        eventName,
        frameworkCrossThreadIdentifier,
      );
    } else if (frameworkCrossThreadIdentifier == null) {
      wasmContext.__wasm_add_event_bts(
        uniqueId,
        eventType,
        eventName,
        undefined,
      );
      wasmContext.__wasm_add_event_run_worklet(
        uniqueId,
        eventType,
        eventName,
        undefined,
      );
    } else if (typeof frameworkCrossThreadIdentifier === 'object') {
      wasmContext.__wasm_add_event_run_worklet(
        uniqueId,
        eventType,
        eventName,
        frameworkCrossThreadIdentifier,
      );
    }
  };
  return {
    __CreateView(parentComponentUniqueId: number) {
      const dom = document.createElement('x-view') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      uniqueIdToElement[dom[uniqueIdSymbol]] = dom;
      return dom;
    },
    __CreateText(parentComponentUniqueId) {
      const dom = document.createElement('x-text') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      uniqueIdToElement[dom[uniqueIdSymbol]] = dom;
      return dom;
    },
    __CreateImage(parentComponentUniqueId) {
      const dom = document.createElement('x-image') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      uniqueIdToElement[dom[uniqueIdSymbol]] = dom;
      return dom;
    },
    __CreateRawText(text) {
      const dom = document.createElement('raw-text') as DecoratedHTMLElement;
      dom.setAttribute('text', text);
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(-1, dom);
      uniqueIdToElement[dom[uniqueIdSymbol]] = dom;
      return dom;
    },
    __CreateScrollView(parentComponentUniqueId) {
      const dom = document.createElement('scroll-view') as DecoratedHTMLElement;

      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      uniqueIdToElement[dom[uniqueIdSymbol]] = dom;
      return dom;
    },
    __CreateElement(tagName, parentComponentUniqueId) {
      const dom = document.createElement(
        LYNX_TAG_TO_HTML_TAG_MAP[tagName] ?? tagName,
      ) as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      uniqueIdToElement[dom[uniqueIdSymbol]] = dom;
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
      uniqueIdToElement[dom[uniqueIdSymbol]] = dom;
      return dom;
    },
    __CreateWrapperElement(parentComponentUniqueId) {
      const dom = document.createElement(
        'lynx-wrapper',
      ) as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.__CreateElementCommon(
        parentComponentUniqueId,
        dom,
      );
      uniqueIdToElement[dom[uniqueIdSymbol]] = dom;
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
      uniqueIdToElement[dom[uniqueIdSymbol]] = dom;
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
      dom.setAttribute('part', 'page');
      page = dom;
      uniqueIdToElement[dom[uniqueIdSymbol]] = dom;
      return dom;
    },
    __ElementFromBinary(templateId, parentComponentUniqueId) {
      let template_root = wasmContext._wasm_elementFromBinary(
        parentComponentUniqueId,
        entryTemplateUrl,
        templateId,
        templateManager.getTemplate(entryTemplateUrl)!.elementTemplates!,
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
        mtsBinding.lynxViewInstance.styleManager!.updateCssOgStyle(
          uniqueId,
          wasmContext.__wasm_get_css_id_by_unique_id(uniqueId)!,
          element.classList,
          element.getAttribute(lynxEntryNameAttribute) || undefined,
        );
      }),
    __SetCSSId,
    __AddInlineStyle: (
      element,
      key,
      value,
    ) => {
      if (typeof value != 'string') {
        value = (value as number).toString();
      }
      if (typeof key === 'number') {
        return wasmContext.__wasm_AddInlineStyle_number_key(
          element,
          key,
          value as string | null,
        );
      } else {
        return wasmContext.__wasm_AddInlineStyle_str_key(
          element,
          key.toString(),
          value as string | null,
        );
      }
    },
    __SetInlineStyles: (
      element,
      value,
    ) => {
      if (!value) {
        element.removeAttribute('style');
      } else {
        const styleString = typeof value === 'string'
          ? value
          : Object.entries(value).map(([k, v]) =>
            `${hyphenateStyleName(k)}: ${v};`
          ).join();
        if (
          !wasmContext.__wasm_SetInlineStyles(
            element,
            styleString,
          )
        ) {
          element.setAttribute('style', styleString);
        }
      }
    },
    __AddConfig: (element, type, value) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      const config = wasmContext.__GetConfig(uniqueId);
      // @ts-ignore
      config[type] = value;
    },
    __UpdateComponentInfo: (element, componentInfo) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      const { componentID, cssID, entry, name } = componentInfo;
      if (name) {
        element.setAttribute('name', name);
      } else {
        element.removeAttribute('name');
      }
      wasmContext.__UpdateComponentID(
        uniqueId,
        componentID,
      );
      if (cssID !== undefined) {
        __SetCSSId(
          [element],
          cssID,
          entry,
        );
      }
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
      wasmContext.__SetDataset(uniqueId, element, dataset);
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
        if (name === 'exposure-id') {
          if (value != null) {
            const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
            mtsBinding.markExposureRelatedElementByUniqueId(uniqueId, true);
          } else {
            const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
            mtsBinding.markExposureRelatedElementByUniqueId(uniqueId, false);
          }
        }
      }
    },
    __AddEvent,
    __GetEvent: (element, eventType, eventName) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.__GetEvent(uniqueId, eventType, eventName);
    },
    __GetEvents: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.__GetEvents(uniqueId) as any;
    },
    __SetEvents: (element, events) => {
      for (const event of events) {
        __AddEvent(
          element,
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
    __FlushElementTree: (_, options) => {
      const pipelineId = options?.pipelineOptions?.pipelineID;
      const backgroundThread = mtsBinding.lynxViewInstance.backgroundThread;
      if (
        page && !page.parentNode
        && page.getAttribute(lynxDisposedAttribute) !== ''
      ) {
        backgroundThread.markTiming('dispatch_start', pipelineId);
        backgroundThread.jsContext.dispatchEvent({
          type: '__OnNativeAppReady',
          data: undefined,
        });
        backgroundThread.markTiming('layout_start', pipelineId);
        backgroundThread.markTiming('ui_operation_flush_start', pipelineId);
        rootDom.appendChild(page);
        (rootDom.host as HTMLElement).style.display = 'flex';
        backgroundThread.markTiming('ui_operation_flush_end', pipelineId);
        backgroundThread.markTiming('layout_end', pipelineId);
        backgroundThread.markTiming('dispatch_end', pipelineId);
        backgroundThread.flushTimingInfo();
      }
      let timingFlagsAll = timingFlags.concat(
        wasmContext.__wasm_take_timing_flags(),
      );
      requestAnimationFrame(() => {
        mtsBinding.postTimingFlags(
          timingFlagsAll,
          pipelineId,
        );
      });
      timingFlags.length = 0;
      const enabledExposureElements = [
        ...mtsBinding.toBeEnabledElement,
      ];
      mtsBinding.toBeEnabledElement.clear();
      mtsBinding?.updateExposureStatus(
        enabledExposureElements,
      );
    },
  };
}
