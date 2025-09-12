// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type WASMModule = typeof import('./standard.js');
export declare let wasm: WASMModule;
export declare function initWasm(): Promise<void>;

export declare function prepareMainThreadAPIs(
  backgroundThreadRpc: any,
  rootDom: Document | ShadowRoot,
  document: Document,
  mtsRealm: any,
  commitDocument: (
    exposureChangedElements: HTMLElement[],
  ) => Promise<void> | void,
  markTimingInternal: (timingKey: string, pipelineId?: string) => void,
  flushMarkTimingInternal: () => void,
  reportError: any,
  triggerI18nResourceFallback: (options: any) => void,
  initialI18nResources: (data: any) => any,
  ssrHooks?: any,
): Promise<
  { startMainThread: (config: any, ssrHydrateInfo?: any) => Promise<void> }
>;

export declare function createMainThreadLynx(
  config: any,
  SystemInfo: Record<string, any>,
): Promise<any>;

export * from './createMainThreadGlobalThis.js';
