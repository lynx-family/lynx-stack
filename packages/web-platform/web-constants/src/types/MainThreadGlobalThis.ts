import type { systemInfo } from '../constants.js';
import type { Cloneable } from './Cloneable.js';
import type {
  ComponentAtIndexCallback,
  EnqueueComponentCallback,
} from './Element.js';
import type { LynxEventType } from './EventType.js';
import type { FlushElementTreeOptions } from './FlushElementTreeOptions.js';
import type { I18nResourceTranslationOptions } from './index.js';
import type { MainThreadLynx } from './MainThreadLynx.js';
import type { ProcessDataCallback } from './ProcessDataCallback.js';
import type { UpdateDataOptions } from './UpdateDataOptions.js';

type ElementPAPIEventHandler =
  | string
  | { type: 'worklet'; value: unknown }
  | undefined;

export type AddEventPAPI = (
  element: HTMLElement,
  eventType: LynxEventType,
  eventName: string,
  newEventHandler: ElementPAPIEventHandler,
) => void;

export type GetEventPAPI = (
  element: HTMLElement,
  eventName: string,
  eventType: LynxEventType,
) => ElementPAPIEventHandler;

export type GetEventsPAPI = (
  element: HTMLElement,
) => {
  type: LynxEventType;
  name: string;
  function: ElementPAPIEventHandler;
}[];

export type SetEventsPAPI = (
  element: HTMLElement,
  listeners: {
    type: LynxEventType;
    name: string;
    function: ElementPAPIEventHandler;
  }[],
) => void;

export type AppendElementPAPI = (
  parent: HTMLElement,
  child: HTMLElement,
) => void;

export type ElementIsEqualPAPI = (
  left: HTMLElement | null,
  right: HTMLElement | null,
) => boolean;

export type FirstElementPAPI = (
  element: HTMLElement,
) => HTMLElement | null;

export type GetChildrenPAPI = (
  element: HTMLElement,
) => HTMLElement[];

export type GetParentPAPI = (
  element: HTMLElement,
) => HTMLElement | null;

export type InsertElementBeforePAPI = (
  parent: HTMLElement,
  child: HTMLElement,
  ref?: HTMLElement | null,
) => HTMLElement;

export type LastElementPAPI = (
  element: HTMLElement,
) => HTMLElement | null;

export type NextElementPAPI = (
  element: HTMLElement,
) => HTMLElement | null;

export type RemoveElementPAPI = (
  parent: HTMLElement,
  child: HTMLElement,
) => HTMLElement;

export type ReplaceElementPAPI = (
  newElement: HTMLElement,
  oldElement: HTMLElement,
) => void;

export type ReplaceElementsPAPI = (
  parent: HTMLElement,
  newChildren: HTMLElement[] | HTMLElement,
  oldChildren?: HTMLElement[] | HTMLElement | null | undefined,
) => void;

export type AddConfigPAPI = (
  element: HTMLElement,
  type: string,
  value: Cloneable,
) => void;

export type AddDatasetPAPI = (
  element: HTMLElement,
  key: string,
  value: Cloneable,
) => void;

export type GetDatasetPAPI = (
  element: HTMLElement,
) => Record<string, Cloneable>;

export type GetDataByKeyPAPI = (
  element: HTMLElement,
  key: string,
) => Cloneable | undefined;

export type GetAttributesPAPI = (
  element: HTMLElement,
) => Record<string, string>;

export type GetComponentIdPAPI = (
  element: HTMLElement,
) => string | null | undefined;

export type GetElementConfigPAPI = (
  element: HTMLElement,
) => Record<string, Cloneable>;

export type GetElementUniqueIDPAPI = (
  element: HTMLElement,
) => number;

export type GetIDPAPI = (
  element: HTMLElement,
) => string | null;

export type GetTagPAPI = (
  element: HTMLElement,
) => string;

export type SetConfigPAPI = (
  element: HTMLElement,
  config: Record<string, Cloneable>,
) => void;

export type SetDatasetPAPI = (
  element: HTMLElement,
  dataset: Record<string, Cloneable>,
) => void;

export type SetIDPAPI = (
  element: HTMLElement,
  id: string | null,
) => void;

export type UpdateComponentIDPAPI = (
  element: HTMLElement,
  componentID: string,
) => void;

export type UpdateComponentInfoPAPI = (
  element: HTMLElement,
  params: {
    componentID?: string;
    name?: string;
    path?: string;
    entry?: string;
    cssID?: number;
  },
) => void;

export type GetClassesPAPI = (
  element: HTMLElement,
) => string[];

export type CreateViewPAPI = (
  parentComponentUniqueID: number,
) => HTMLElement;

export type SwapElementPAPI = (
  childA: HTMLElement,
  childB: HTMLElement,
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
  element: HTMLElement,
  key: Exclude<string, 'update-list-info'>,
  value: string | null | undefined | boolean,
) => void;
export type SetAttributePAPIUpdateListInfo = (
  element: HTMLElement,
  key: 'update-list-info',
  value: UpdateListInfoAttributeValue | null,
) => void;

export type UpdateListCallbacksPAPI = (
  element: HTMLElement,
  componentAtIndex: ComponentAtIndexCallback,
  enqueueComponent: EnqueueComponentCallback,
) => void;

export type CreateTextPAPI = CreateViewPAPI;

export type CreateRawTextPAPI = (text: string) => HTMLElement;

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
) => HTMLElement;

export type CreateElementPAPI = (
  tagName: string,
  parentComponentUniqueId: number,
  info?: Record<string, Cloneable> | null | undefined,
) => HTMLElement;

export type CreatePagePAPI = (
  componentID: string,
  cssID: number,
  info?: Record<string, Cloneable> | null | undefined,
) => HTMLElement;

export type CreateListPAPI = (
  parentComponentUniqueId: number,
  componentAtIndex: ComponentAtIndexCallback,
  enqueueComponent: EnqueueComponentCallback,
) => HTMLElement;

export type AddClassPAPI = (
  element: HTMLElement,
  className: string,
) => void;

export type SetClassesPAPI = (
  element: HTMLElement,
  classNames: string | null,
) => void;

export type AddInlineStylePAPI = (
  element: HTMLElement,
  key: number | string,
  value: string | number | null | undefined,
) => void;

export type SetInlineStylesPAPI = (
  element: HTMLElement,
  value: string | Record<string, string> | undefined,
) => void;

export type SetCSSIdPAPI = (
  elements: HTMLElement[],
  cssId: number | null,
  entryName: string | undefined,
) => void;

export type GetPageElementPAPI = () => HTMLElement | undefined;

export type MarkTemplateElementPAPI = (
  element: HTMLElement,
) => void;

export type MarkPartElementPAPI = (
  element: HTMLElement,
  partId: string,
) => void;

export type GetTemplatePartsPAPI = (
  templateElement: HTMLElement,
) => Record<string, HTMLElement>;

interface JSErrorInfo {
  release: string;
}

export type ElementFromBinaryPAPI = (
  templateId: string,
  parentComponentUniId: number,
) => HTMLElement[];

export type GetAttributeByNamePAPI = (
  element: HTMLElement,
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
export interface ElementPAPIs {
  __ElementFromBinary: ElementFromBinaryPAPI;

  // __GetTemplateParts currently only provided by the thread-strategy = "all-on-ui" (default)
  __GetTemplateParts: GetTemplatePartsPAPI;

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
  __SetAttribute: SetAttributePAPI & SetAttributePAPIUpdateListInfo;
  __UpdateListCallbacks: UpdateListCallbacksPAPI;
  __AddClass: AddClassPAPI;
  __SetClasses: SetClassesPAPI;
  __AddInlineStyle: AddInlineStylePAPI;
  __SetInlineStyles: SetInlineStylesPAPI;
  __SetCSSId: SetCSSIdPAPI;
  __GetPageElement: GetPageElementPAPI;
  __GetAttributeByName: GetAttributeByNamePAPI;
  __FlushElementTree: (
    _subTree?: unknown,
    options?: FlushElementTreeOptions,
  ) => void;
}

export interface MainThreadGlobalThis extends ElementPAPIs {
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
