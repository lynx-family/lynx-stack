import type { systemInfo } from '../constants.js';
import type { Cloneable } from './Cloneable.js';
import type {
  ComponentAtIndexCallback,
  EnqueueComponentCallback,
  EventHandlerMap,
} from './Element.js';
import type { LynxEventType } from './EventType.js';
import type { FlushElementTreeOptions } from './FlushElementTreeOptions.js';
import type { I18nResourceTranslationOptions } from './index.js';
import type { MainThreadLynx } from './MainThreadLynx.js';
import type { ProcessDataCallback } from './ProcessDataCallback.js';
import type { UpdateDataOptions } from './UpdateDataOptions.js';
import type {
  eventHandlerMapPropertyName,
  enqueueComponentPropertyName,
  componentAtIndexPropertyName,
} from '../constants.js';

type ElementPAPIEventHandler =
  | string
  | { type: 'worklet'; value: unknown }
  | undefined;

export type AddEventPAPI = (
  element: Element & {
    [eventHandlerMapPropertyName]: EventHandlerMap | undefined;
  },
  eventType: LynxEventType,
  eventName: string,
  newEventHandler: ElementPAPIEventHandler,
) => void;

export type GetEventPAPI = (
  element: Element & {
    [eventHandlerMapPropertyName]: EventHandlerMap | undefined;
  },
  eventName: string,
  eventType: LynxEventType,
) => ElementPAPIEventHandler;

export type GetEventsPAPI = (
  element: Element & {
    [eventHandlerMapPropertyName]: EventHandlerMap | undefined;
  },
) => {
  type: LynxEventType;
  name: string;
  function: ElementPAPIEventHandler;
}[];

export type SetEventsPAPI = (
  element: Element & {
    [eventHandlerMapPropertyName]: EventHandlerMap | undefined;
  },
  listeners: {
    type: LynxEventType;
    name: string;
    function: ElementPAPIEventHandler;
  }[],
) => void;

export type AppendElementPAPI = (
  parent: Element,
  child: Element,
) => void;

export type ElementIsEqualPAPI = (
  left: Element,
  right: Element,
) => boolean;

export type FirstElementPAPI = (
  element: Element,
) => Element | null;

export type GetChildrenPAPI = (
  element: Element,
) => Element[] | null;

export type GetParentPAPI = (
  element: Element,
) => Element | null;

export type InsertElementBeforePAPI = (
  parent: Element,
  child: Element,
  ref?: Element | null,
) => Element;

export type LastElementPAPI = (
  element: Element,
) => Element | null;

export type NextElementPAPI = (
  element: Element,
) => Element | null;

export type RemoveElementPAPI = (
  parent: Element,
  child: Element,
) => Element;

export type ReplaceElementPAPI = (
  newElement: Element,
  oldElement: Element,
) => void;

export type ReplaceElementsPAPI = (
  parent: Element,
  newChildren: Element[] | Element,
  oldChildren?: Element[] | Element | null | undefined,
) => void;

export type AddConfigPAPI = (
  element: Element,
  type: string,
  value: Cloneable,
) => void;

export type AddDatasetPAPI = (
  element: Element,
  key: string,
  value: Cloneable,
) => void;

export type GetDatasetPAPI = (
  element: Element,
) => Record<string, Cloneable>;

export type GetDataByKeyPAPI = (
  element: Element,
  key: string,
) => Cloneable | undefined;

export type GetAttributesPAPI = (
  element: Element,
) => Record<string, string>;

export type GetComponentIdPAPI = (
  element: Element,
) => string | null;

export type GetElementConfigPAPI = (
  element: Element,
) => Record<string, Cloneable>;

export type GetElementUniqueIDPAPI = (
  element: Element,
) => number;

export type GetIDPAPI = (
  element: Element,
) => string | null;

export type GetTagPAPI = (
  element: Element,
) => string;

export type SetConfigPAPI = (
  element: Element,
  config: Record<string, Cloneable>,
) => void;

export type SetDatasetPAPI = (
  element: Element,
  dataset: Record<string, Cloneable>,
) => void;

export type SetIDPAPI = (
  element: Element,
  id: string | null,
) => void;

export type UpdateComponentIDPAPI = (
  element: Element,
  componentID: string,
) => void;

export type UpdateComponentInfoPAPI = (
  element: Element,
  params: {
    componentID?: string;
    name?: string;
    path?: string;
    entry?: string;
    cssID?: number;
  },
) => void;

export type GetClassesPAPI = (
  element: Element,
) => string[];

export type CreateViewPAPI = (
  parentComponentUniqueID: number,
) => Element;

export type SwapElementPAPI = (
  childA: Element,
  childB: Element,
) => void;

export type UpdateListInfoAttributeValue = {
  insertAction: {
    position: number;
  }[];
  removeAction: {
    position: number;
  }[];
};
export type SetAttributePAPI = (
  element: Element,
  key: string,
  value: string | null | undefined | UpdateListInfoAttributeValue,
) => void;

export type UpdateListCallbacksPAPI = (
  element: Element & {
    [enqueueComponentPropertyName]: EnqueueComponentCallback;
    [componentAtIndexPropertyName]: ComponentAtIndexCallback;
  },
  componentAtIndex: ComponentAtIndexCallback,
  enqueueComponent: EnqueueComponentCallback,
) => void;

export type CreateTextPAPI = CreateViewPAPI;

export type CreateRawTextPAPI = (text: string) => Element;

export type CreateImagePAPI = CreateViewPAPI;

export type CreateScrollViewPAPI = CreateViewPAPI;

export type CreateWrapperElementPAPI = CreateViewPAPI;

export type CreateComponentPAPI = (
  componentParentUniqueID: number,
  componentID: string,
  cssID: number,
  entryName: string,
  name: string,
  path: string,
  config: Record<string, Cloneable> | null | undefined,
  info: Record<string, Cloneable> | null | undefined,
) => Element;

export type CreateElementPAPI = (
  tagName: string,
  parentComponentUniqueId: number,
  info?: Record<string, Cloneable> | null | undefined,
) => Element;

export type CreatePagePAPI = (
  componentID: string,
  cssID: number,
  info: Record<string, Cloneable> | null | undefined,
) => Element;

export type CreateListPAPI = (
  parentComponentUniqueId: number,
  componentAtIndex: ComponentAtIndexCallback,
  enqueueComponent: EnqueueComponentCallback,
) => Element;

export type AddClassPAPI = (
  element: Element,
  className: string,
) => void;

export type SetClassesPAPI = (
  element: Element,
  classNames: string | null,
) => void;

export type AddInlineStylePAPI = (
  element: Element,
  key: number | string,
  value: string | number | null | undefined,
) => void;

export type SetInlineStylesPAPI = (
  element: Element,
  value: string | Record<string, string> | undefined,
) => void;

export type SetCSSIdPAPI = (
  elements: Element[],
  cssId: number | null,
  entryName: string | undefined,
) => void;

export type GetPageElementPAPI = () => Element | undefined;

export type MarkTemplateElementPAPI = (
  element: Element,
) => void;

export type MarkPartElementPAPI = (
  element: Element,
  partId: string,
) => void;

export type GetTemplatePartsPAPI = (
  templateElement: Element,
) => Record<string, Element>;

interface JSErrorInfo {
  release: string;
}

export type ElementFromBinaryPAPI = (
  templateId: string,
  parentComponentUniId: number,
) => Element[];

export type GetAttributeByNamePAPI = (
  element: Element,
  name: string,
) => string | null;

export type QueryComponentPAPI = (
  source: string,
  resultCallback?: (result: {
    code: number;
    data?: {
      url: string;
      evalResult: unknown;
    };
  }) => void,
) => null;

export interface MainThreadGlobalThis {
  __ElementFromBinary: ElementFromBinaryPAPI;

  // __GetTemplateParts currently only provided by the thread-strategy = "all-on-ui" (default)
  __GetTemplateParts?: GetTemplatePartsPAPI;

  __MarkPartElement: MarkPartElementPAPI;
  __MarkTemplateElement: MarkTemplateElementPAPI;
  __AddEvent: AddEventPAPI;
  __GetEvent: GetEventPAPI;
  __GetEvents: GetEventsPAPI;
  __SetEvents: SetEventsPAPI;
  __AppendElement: AppendElementPAPI;
  __ElementIsEqual: ElementIsEqualPAPI;
  __FirstElement: FirstElementPAPI;
  __GetChildren: GetChildrenPAPI;
  __GetParent: GetParentPAPI;
  __InsertElementBefore: InsertElementBeforePAPI;
  __LastElement: LastElementPAPI;
  __NextElement: NextElementPAPI;
  __RemoveElement: RemoveElementPAPI;
  __ReplaceElement: ReplaceElementPAPI;
  __ReplaceElements: ReplaceElementsPAPI;
  __AddConfig: AddConfigPAPI;
  __AddDataset: AddDatasetPAPI;
  __GetDataset: GetDatasetPAPI;
  __GetDataByKey: GetDataByKeyPAPI;
  __GetAttributes: GetAttributesPAPI;
  __GetComponentID: GetComponentIdPAPI;
  __GetElementConfig: GetElementConfigPAPI;
  __GetElementUniqueID: GetElementUniqueIDPAPI;
  __GetID: GetIDPAPI;
  __GetTag: GetTagPAPI;
  __SetConfig: SetConfigPAPI;
  __GetConfig: GetElementConfigPAPI;
  __SetDataset: SetDatasetPAPI;
  __SetID: SetIDPAPI;
  __UpdateComponentID: UpdateComponentIDPAPI;
  __UpdateComponentInfo: UpdateComponentInfoPAPI;
  __GetClasses: GetClassesPAPI;
  __CreateView: CreateViewPAPI;
  __SwapElement: SwapElementPAPI;
  __CreateText: CreateTextPAPI;
  __CreateRawText: CreateRawTextPAPI;
  __CreateImage: CreateImagePAPI;
  __CreateScrollView: CreateScrollViewPAPI;
  __CreateWrapperElement: CreateWrapperElementPAPI;
  __CreateComponent: CreateComponentPAPI;
  __CreateElement: CreateElementPAPI;
  __CreatePage: CreatePagePAPI;
  __CreateList: CreateListPAPI;
  __SetAttribute: SetAttributePAPI;
  __UpdateListCallbacks: UpdateListCallbacksPAPI;
  __AddClass: AddClassPAPI;
  __SetClasses: SetClassesPAPI;
  __AddInlineStyle: AddInlineStylePAPI;
  __SetInlineStyles: SetInlineStylesPAPI;
  __SetCSSId: SetCSSIdPAPI;
  __GetPageElement: GetPageElementPAPI;
  __GetAttributeByName: GetAttributeByNamePAPI;
  __globalProps: unknown;
  SystemInfo: typeof systemInfo;
  globalThis?: MainThreadGlobalThis;
  lynx: MainThreadLynx;
  processData?: ProcessDataCallback;
  ssrEncode?: () => string;
  ssrHydrate?: (encodeData?: string | null) => void;
  _ReportError: (error: Error, _: unknown) => void;
  _SetSourceMapRelease: (errInfo: JSErrorInfo) => void;
  __OnLifecycleEvent: (lifeCycleEvent: Cloneable) => void;
  __LoadLepusChunk: (path: string) => boolean;
  __FlushElementTree: (
    _subTree: unknown,
    options: FlushElementTreeOptions,
  ) => void;
  _I18nResourceTranslation: (
    options: I18nResourceTranslationOptions,
  ) => unknown | undefined;
  // This is an empty implementation, just to avoid business call errors
  _AddEventListener: (...args: unknown[]) => void;
  __QueryComponent: QueryComponentPAPI;
  // DSL runtime binding
  processEvalResult?: (
    exports: unknown,
    schema: string,
  ) => unknown;
  // the following methods is assigned by the main thread user code
  renderPage: ((data: unknown) => void) | undefined;
  updatePage?: (data: Cloneable, options?: UpdateDataOptions) => void;
  runWorklet?: (obj: unknown, event: unknown) => void;
}
