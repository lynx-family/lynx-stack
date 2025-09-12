// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  type Rpc,
  type RpcCallType,
  type reportErrorEndpoint,
  type I18nResourceTranslationOptions,
  type InitI18nResources,
  type I18nResources,
  type SSRDehydrateHooks,
  type JSRealm,
} from '@lynx-js/web-constants';
import { initWasm, wasm } from '../index.js';

export async function prepareMainThreadAPIs(
  backgroundThreadRpc: Rpc,
  rootDom: Document | ShadowRoot,
  document: Document,
  mtsRealm: JSRealm,
  commitDocument: (
    exposureChangedElements: HTMLElement[],
  ) => Promise<void> | void,
  markTimingInternal: (timingKey: string, pipelineId?: string) => void,
  flushMarkTimingInternal: () => void,
  reportError: RpcCallType<typeof reportErrorEndpoint>,
  triggerI18nResourceFallback: (
    options: I18nResourceTranslationOptions,
  ) => void,
  initialI18nResources: (data: InitI18nResources) => I18nResources,
  ssrHooks?: SSRDehydrateHooks,
) {
  // Initialize WASM if not already done
  if (!wasm) {
    await initWasm();
  }

  // Use the Rust implementation (note: ssrHooks not yet supported in Rust version)
  return wasm.prepare_main_thread_apis(
    backgroundThreadRpc,
    rootDom,
    document,
    mtsRealm,
    commitDocument,
    markTimingInternal,
    flushMarkTimingInternal,
    reportError,
    triggerI18nResourceFallback,
    initialI18nResources,
    // ssrHooks not currently supported in simplified Rust implementation
  );
}
