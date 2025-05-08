// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '@lynx-js/types';
import { Lynx as LynxApi } from '../src/lynx-api.js';

declare global {
  declare const __DISABLE_CREATE_SELECTOR_QUERY_INCOMPATIBLE_WARNING__: boolean;
  declare const __REF_FIRE_IMMEDIATELY__: boolean;
  declare const __TESTING_FORCE_RENDER_TO_OPCODE__: boolean;
  declare const __FIRST_SCREEN_SYNC_TIMING__: 'immediately' | 'jsReady';
  declare const __DEV__: boolean;
  declare const __JS__: boolean;
  declare const __LEPUS__: boolean;
  declare const __BACKGROUND__: boolean;
  declare const __MAIN_THREAD__: boolean;
  declare const __PROFILE__: boolean;
  declare const __ENABLE_SSR__: boolean;

  declare function __CreatePage(componentId: string, cssId: number): FiberElement;
  declare function __CreateElement(
    tag: string,
    parentComponentUniqueId: number,
  ): FiberElement;
  declare function __CreateWrapperElement(
    parentComponentUniqueId: number,
  ): FiberElement;
  declare function __CreateText(parentComponentUniqueId: number): FiberElement;
  declare function __CreateImage(parentComponentUniqueId: number): FiberElement;
  declare function __CreateView(parentComponentUniqueId: number): FiberElement;
  declare function __CreateRawText(s: string): FiberElement;
  declare function __CreateList(
    parentComponentUniqueId: number,
    componentAtIndex: ComponentAtIndexCallback,
    enqueueComponent: EnqueueComponentCallback,
    info?: any,
    componentAtIndexes: ComponentAtIndexesCallback,
  ): FiberElement;
  declare function __AppendElement(
    parent: FiberElement,
    child: FiberElement,
  ): FiberElement;
  declare function __InsertElementBefore(
    parent: FiberElement,
    child: FiberElement,
    ref?: FiberElement,
  ): FiberElement;
  declare function __RemoveElement(
    parent: FiberElement,
    child: FiberElement,
  ): FiberElement;
  declare function __ReplaceElement(
    a: FiberElement,
    b: FiberElement,
  ): FiberElement;
  declare function __FirstElement(parent: FiberElement): FiberElement;
  declare function __LastElement(parent: FiberElement): FiberElement;
  declare function __NextElement(parent: FiberElement): FiberElement;
  declare function __GetPageElement(): FiberElement | undefined;
  declare function __GetTemplateParts(e: FiberElement): Record<string, FiberElement>;
  declare function __AddDataset(node: FiberElement, key: string, value: any): void;
  declare function __SetDataset(
    node: FiberElement,
    value: Record<string, any>,
  ): void;
  declare function __GetDataset(node: FiberElement): Record<string, any>;
  declare function __SetAttribute(e: FiberElement, key: string, value: any): void;
  declare function __GetAttributes(e: FiberElement): Record<string, any>;
  declare function __GetAttributeByName(e: FiberElement, name: string): any;
  declare function __GetAttributeNames(e: FiberElement): string[];
  declare function __SetClasses(e: FiberElement, c: string): void;
  declare function __SetCSSId(e: FiberElement | FiberElement[], cssId: number, entryName?: string): void;
  declare function __AddInlineStyle(
    e: FiberElement,
    key: number | string,
    value: any,
  ): void;
  declare function __SetInlineStyles(e: FiberElement, style: string): void;
  declare function __AddEvent(
    e: FiberElement,
    eventType: string,
    eventName: string,
    event: Record<string, any> | string | undefined,
  ): void;
  declare function __SetID(e: FiberElement, id: string | undefined | null): void;
  declare function __GetElementUniqueID(e: FiberElement): number;
  declare function __GetTag(e: FiberElement): string;
  declare function __FlushElementTree(): void;
  declare function __FlushElementTree(element: FiberElement): void;
  declare function __FlushElementTree(
    element: FiberElement,
    options: FlushOptions,
  ): void;
  declare function __UpdateListCallbacks(
    list: FiberElement,
    componentAtIndex: ComponentAtIndexCallback,
    enqueueComponent: EnqueueComponentCallback,
    componentAtIndexes: ComponentAtIndexesCallback,
  ): void;
  declare function __OnLifecycleEvent(...args: any[]): void;
  declare function _ReportError(
    error: Error,
    options: { errorCode: number },
  ): void;
  declare function __QueryComponent(source: string): { evalResult: any };
  declare function __SetGestureDetector(
    node: FiberElement,
    id: number,
    type: number,
    config: any,
    relationMap: Record<string, number[]>,
  ): void;

  declare interface FiberElement {}

  declare type ComponentAtIndexCallback = (
    list: FiberElement,
    listID: number,
    cellIndex: number,
    operationID: number,
    enableReuseNotification: boolean,
  ) => void;

  declare type ComponentAtIndexesCallback = (
    list: FiberElement,
    listID: number,
    cellIndexes: number[],
    operationIDs: number[],
    enableReuseNotification: boolean,
    asyncFlush: boolean,
  ) => void;

  declare type EnqueueComponentCallback = (
    list: FiberElement,
    listID: number,
    sign: number,
  ) => void;

  declare interface FlushOptions {
    triggerLayout?: boolean;
    operationID?: any;
    __lynx_timing_flag?: string;
    nativeUpdateDataOrder?: number;
    elementID?: number;
    listID?: number;
    listReuseNotification?: {
      listElement: FiberElement;
      itemKey: string;
    };
    pipelineOptions?: PipelineOptions;
    elementIDs?: number[];
    operationIDs?: any[];
    asyncFlush?: boolean;
  }

  declare interface UpdatePageOption {
    nativeUpdateDataOrder?: number;
    reloadTemplate?: boolean;
    reloadFromJS?: boolean;
    resetPageData?: boolean;
    pipelineOptions?: PipelineOptions;
  }

  declare interface LynxCallByNative {
    renderPage: (data: any) => void;
    updatePage: (data: any, options?: UpdatePageOption) => void;
    // processData: (data: any, processorName?: string) => any;
    updateGlobalProps: (data: any, options?: UpdatePageOption) => void;
    getPageData: () => any;
    removeComponents: () => void;
  }

  namespace lynxCoreInject {
    const tt: any;
  }

  declare interface PipelineOptions {
    pipelineID: string; // Returned by native when calling `onPipelineStart()`
    pipelineOrigin: string; // The origin of the pipeline
    needTimestamps: boolean; // Whether timing points should be reported
    dsl: string;
    stage: string;
  }

  declare let lynxCoreInject: any;

  interface ISystemInfo {
    osVersion: string;
    pixelHeight: number;
    pixelRatio: number;
    pixelWidth: number;
    platform: string;
    theme: object;
    /**
     * The version of the Lynx SDK.
     * @since Lynx 2.4
     * @example '2.4', '2.10'
     */
    lynxSdkVersion?: string;
  }
  declare let SystemInfo: ISystemInfo;

  declare namespace RuntimeProxy {
    interface Event {
      type: string;
      data: any;
      origin?: string;
    }
  }

  declare class RuntimeProxy {
    dispatchEvent(event: RuntimeProxy.Event): void;

    postMessage(message: any);

    addEventListener(type: string, callback: (event: RuntimeProxy.Event) => void);

    removeEventListener(
      type: string,
      callback: (event: RuntimeProxy.Event) => void,
    );

    onTriggerEvent(callback: (event: RuntimeProxy.Event) => void);
  }
}

interface NativeApp {
  callLepusMethod(name: string, args: Record<string, unknown>, callback?: (ret: any) => void): void;
  markTiming?(timingFlag: string, key: string): void;
  createJSObjectDestructionObserver?(callback: () => void): unknown;
}

interface NativeLynx {
  /**
   * @deprecated
   */
  QueryComponent?(source: string, callback: (result: any) => void): void;
}

declare module '@lynx-js/types/background' {
  interface Lynx extends LynxApi {
    __initData: Record<string, unknown>;

    getNativeApp(): NativeApp;
    getNativeLynx(): NativeLynx;
    reportError(e: Error): void;
    QueryComponent?(source: string, callback: (result: any) => void): void;
    loadLazyBundle?<T extends { default: React.ComponentType<any> }>(source: string): Promise<T>;

    /**
     * @since 2.14
     */
    getCoreContext?(): RuntimeProxy;

    /**
     * @since 2.14
     */
    getJSContext?(): RuntimeProxy;
  }

  interface Performance {
    _generatePipelineOptions?(): PipelineOptions;
    /**
     * @param pipelineID - Returned by native when calling {@link _generatePipelineOptions}.
     * @param options - Added since 3.1. See {@link PipelineOptions} for more details.
     */
    _onPipelineStart?(pipelineID: string, options?: PipelineOptions): void;
    _bindPipelineIdWithTimingFlag?(pipelineID: string, timingFlag: string): void;
    _markTiming?(pipelineID: string, key: string): void;
  }

  interface SelectorQuery {
    selectUniqueID(uniqueId: string | number): NodesRef;
  }
}
