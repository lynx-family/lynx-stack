import { wasmInstance } from '../../wasm.js';

import {
  LYNX_TAG_TO_HTML_TAG_MAP,
  LYNX_TIMING_FLAG_ATTRIBUTE,
  lynxDefaultDisplayLinearAttribute,
  lynxDefaultOverflowVisibleAttribute,
  lynxDisposedAttribute,
  lynxEntryNameAttribute,
  uniqueIdSymbol,
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
// @ts-expect-error
import IN_SHADOW_CSS_MODERN from '../../../../css/in_shadow.css?inline';
import { requestIdleCallbackImpl } from '../utils/requestIdleCallback.js';

const IN_SHADOW_CSS = URL.createObjectURL(
  new Blob([IN_SHADOW_CSS_MODERN], { type: 'text/css' }),
);
const linkElement = document.createElement('link');
linkElement.rel = 'stylesheet';
linkElement.href = IN_SHADOW_CSS;
linkElement.type = 'text/css';

const {
  MainThreadWasmContext,
  add_inline_style_raw_string_key,
  set_inline_styles_number_key,
  set_inline_styles_in_str,
  get_inline_styles_in_key_value_vec,
} = wasmInstance;

export function createElementAPI(
  rootDom: ShadowRoot,
  mtsBinding: WASMJSBinding,
  config_enable_css_selector: boolean,
  config_default_display_linear: boolean,
  config_default_overflow_visible: boolean,
): ElementPAPIs {
  rootDom.append(linkElement.cloneNode(false));
  const wasmContext = new MainThreadWasmContext(
    rootDom,
    mtsBinding,
    config_enable_css_selector,
  );
  mtsBinding.wasmContext = wasmContext;
  let page: DecoratedHTMLElement | undefined = undefined;
  const timingFlags: string[] = [];

  const __SetCSSId: SetCSSIdPAPI = (elements, cssId, entryName) => {
    const uniqueIds = elements.map(
      (element) => {
        return (element as DecoratedHTMLElement)[uniqueIdSymbol];
      },
    );
    return wasmContext.set_css_id(
      new Uint32Array(uniqueIds),
      cssId ?? 0,
      entryName,
    );
  };
  const __AddEvent: AddEventPAPI = (
    element,
    eventType,
    eventName,
    frameworkCrossThreadIdentifier,
  ) => {
    const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
    if (typeof frameworkCrossThreadIdentifier === 'string') {
      wasmContext.add_cross_thread_event(
        uniqueId,
        eventType,
        eventName,
        frameworkCrossThreadIdentifier,
      );
    } else if (frameworkCrossThreadIdentifier == null) {
      wasmContext.add_cross_thread_event(
        uniqueId,
        eventType,
        eventName,
        undefined,
      );
      wasmContext.add_run_worklet_event(
        uniqueId,
        eventType,
        eventName,
        undefined,
      );
    } else if (typeof frameworkCrossThreadIdentifier === 'object') {
      wasmContext.add_run_worklet_event(
        uniqueId,
        eventType,
        eventName,
        frameworkCrossThreadIdentifier,
      );
    }
    if (eventName === 'uiappear' || eventName === 'uidisappear') {
      const element = wasmContext.get_dom_by_unique_id(uniqueId);
      if (element) {
        mtsBinding.markExposureRelatedElementByUniqueId(
          element,
          frameworkCrossThreadIdentifier != null,
        );
      }
    }
  };
  return {
    __CreateView(parentComponentUniqueId: number) {
      const dom = document.createElement('x-view') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element_common(
        parentComponentUniqueId,
        dom,
      );
      return dom;
    },
    __CreateText(parentComponentUniqueId) {
      const dom = document.createElement('x-text') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element_common(
        parentComponentUniqueId,
        dom,
      );
      return dom;
    },
    __CreateImage(parentComponentUniqueId) {
      const dom = document.createElement('x-image') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element_common(
        parentComponentUniqueId,
        dom,
      );
      return dom;
    },
    __CreateRawText(text) {
      const dom = document.createElement('raw-text') as DecoratedHTMLElement;
      dom.setAttribute('text', text);
      dom[uniqueIdSymbol] = wasmContext.create_element_common(-1, dom);
      return dom;
    },
    __CreateScrollView(parentComponentUniqueId) {
      const dom = document.createElement('scroll-view') as DecoratedHTMLElement;

      dom[uniqueIdSymbol] = wasmContext.create_element_common(
        parentComponentUniqueId,
        dom,
      );
      return dom;
    },
    __CreateElement(tagName, parentComponentUniqueId) {
      const dom = document.createElement(
        LYNX_TAG_TO_HTML_TAG_MAP[tagName] ?? tagName,
      ) as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element_common(
        parentComponentUniqueId,
        dom,
      );
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
      dom[uniqueIdSymbol] = wasmContext.create_element_common(
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
      dom[uniqueIdSymbol] = wasmContext.create_element_common(
        parentComponentUniqueId,
        dom,
      );
      return dom;
    },
    __CreateList(parentComponentUniqueId, componentAtIndex, enqueueComponent) {
      const dom = document.createElement('x-list') as DecoratedHTMLElement;
      dom.componentAtIndex = componentAtIndex;
      dom.enqueueComponent = enqueueComponent;
      dom[uniqueIdSymbol] = wasmContext.create_element_common(
        parentComponentUniqueId,
        dom,
      );
      return dom;
    },
    __CreatePage(componentID, cssID) {
      if (page) return page;
      const dom = document.createElement(
        'div',
      ) as HTMLElement as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element_common(
        0,
        dom,
        cssID,
        componentID,
      );
      if (config_default_overflow_visible) {
        dom.setAttribute(lynxDefaultOverflowVisibleAttribute, 'true');
      }
      if (!config_default_display_linear) {
        dom.setAttribute(lynxDefaultDisplayLinearAttribute, 'false');
      }
      dom.setAttribute('part', 'page');
      page = dom;
      return dom;
    },
    __SetClasses: config_enable_css_selector
      ? __SetClasses
      : ((element, classname) => {
        __SetClasses(element, classname);
        const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
        wasmContext.update_css_og_style(
          uniqueId,
          element.getAttribute(lynxEntryNameAttribute),
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
        return set_inline_styles_number_key(
          element,
          key,
          value as string | null,
        );
      } else {
        return add_inline_style_raw_string_key(
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
        if (typeof value === 'string') {
          if (
            !set_inline_styles_in_str(
              element,
              value,
            )
          ) {
            element.setAttribute('style', value);
          }
        } else if (!value) {
          element.removeAttribute('style');
        } else {
          get_inline_styles_in_key_value_vec(
            element,
            Object.entries(value).flat().map((item) => item.toString()),
          );
        }
      }
    },
    __AddConfig: (element, type, value) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      const config = wasmContext.get_config(uniqueId);
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
      wasmContext.update_component_id(
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
      wasmContext.update_component_id(uniqueId, componentID);
    },
    __GetConfig: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_config(uniqueId) as any;
    },
    __SetConfig: (element, config) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      wasmContext.set_config(uniqueId, config);
    },
    __GetElementConfig: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_element_config(uniqueId) as any;
    },
    __GetComponentID: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_component_id(uniqueId);
    },
    __SetDataset: (element, dataset) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      wasmContext.set_dataset(uniqueId, element, dataset);
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
      wasmContext.add_dataset(uniqueId, key, value);
    },
    __GetDataset: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return Object.assign(
        Object.create(null),
        wasmContext.get_dataset(uniqueId) as any,
      );
    },
    __GetDataByKey: (element, key) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_data_by_key(uniqueId, key);
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
            mtsBinding.markExposureRelatedElementByUniqueId(
              element as HTMLElement,
              true,
            );
          } else {
            mtsBinding.markExposureRelatedElementByUniqueId(
              element as HTMLElement,
              false,
            );
          }
        } else if (name === LYNX_TIMING_FLAG_ATTRIBUTE) {
          timingFlags.push(String(value));
        }
      }
    },
    __AddEvent,
    __GetEvent: (element, eventType, eventName) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_event(uniqueId, eventType, eventName);
    },
    __GetEvents: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_events(uniqueId) as any;
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
        wasmContext.take_timing_flags(),
      );
      requestIdleCallbackImpl(() => {
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
      const disabledExposureElements = [
        ...mtsBinding.toBeDisabledElement,
      ];
      mtsBinding.toBeDisabledElement.clear();
      mtsBinding?.updateExposureStatus(
        enabledExposureElements,
        disabledExposureElements,
      );
    },
  };
}
