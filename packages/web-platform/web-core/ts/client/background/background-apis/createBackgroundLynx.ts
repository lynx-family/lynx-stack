// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  dispatchCoreContextOnBackgroundEndpoint,
  dispatchJSContextOnMainThreadEndpoint,
  fetchExternalBundleEndpoint,
  reloadEndpoint,
} from '../../endpoints.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { createGetCustomSection } from './crossThreadHandlers/createGetCustomSection.js';
import { createElement } from './createElement.js';
import type { Cloneable, NativeApp } from '../../../types/index.js';
import { LynxCrossThreadContext } from '../../LynxCrossThreadContext.js';

export function createBackgroundLynx(
  globalProps: Cloneable,
  customSections: Record<string, Cloneable>,
  nativeApp: NativeApp,
  mainThreadRpc: Rpc,
) {
  const coreContext = new LynxCrossThreadContext({
    rpc: mainThreadRpc,
    receiveEventEndpoint: dispatchCoreContextOnBackgroundEndpoint,
    sendEventEndpoint: dispatchJSContextOnMainThreadEndpoint,
  });
  const fetchExternalBundle = mainThreadRpc.createCall(
    fetchExternalBundleEndpoint,
  );
  // url -> { sectionPath -> JS source }, populated by fetchBundle so the
  // synchronous loadScript can evaluate a section without another round-trip.
  const externalSectionCache = new Map<string, Record<string, string>>();
  // url -> sectionPath -> evaluated module exports (load each section once).
  const externalModuleCache = new Map<string, Map<string, unknown>>();
  return {
    __globalProps: globalProps,
    getJSModule(_moduleName: string): any {
    },
    getNativeApp(): NativeApp {
      return nativeApp;
    },
    getCoreContext() {
      return coreContext;
    },
    getCustomSectionSync(key: string) {
      return customSections[key];
    },
    getCustomSection: createGetCustomSection(
      mainThreadRpc,
      customSections,
    ),
    queueMicrotask: (callback: () => void) => {
      queueMicrotask(callback);
    },
    createElement(_: string, id: string) {
      return createElement(id, mainThreadRpc);
    },
    getI18nResource: () => nativeApp.i18nResource.data,
    QueryComponent: (
      source: string,
      callback: (
        ret: { __hasReady: boolean } | {
          code: number;
          detail?: { schema: string };
        },
      ) => void,
    ) => nativeApp.queryComponent(source, callback),
    reload: () => {
      mainThreadRpc.invoke(reloadEndpoint, []);
    },
    async fetchBundle(url: string) {
      const { sources, ...response } = await fetchExternalBundle(url);
      if (response.code === 0) {
        externalSectionCache.set(response.url, sources);
      }
      return response;
    },
    loadScript(sectionPath: string, options: { bundleName: string }) {
      const { bundleName } = options;
      let modules = externalModuleCache.get(bundleName);
      if (modules?.has(sectionPath)) {
        return modules.get(sectionPath);
      }
      const source = externalSectionCache.get(bundleName)?.[sectionPath];
      if (source === undefined) {
        throw new Error(
          `lynx.loadScript: section "${sectionPath}" not loaded for bundle ${bundleName}. Call lynx.fetchBundle first.`,
        );
      }
      const moduleObj: { exports: unknown } = { exports: {} };
      const fn = new Function(
        'module',
        'exports',
        'lynx',
        'globalThis',
        `${source}\n//# sourceURL=${bundleName}/${sectionPath}`,
      );
      // Pass the chunk's own `lynx` (the lynx-core wrapper) so a section that
      // references `lynx` at evaluation time sees the same object the consumer
      // mounts onto.
      fn(moduleObj, moduleObj.exports, nativeApp.tt?.lynx, globalThis);
      if (!modules) {
        modules = new Map();
        externalModuleCache.set(bundleName, modules);
      }
      modules.set(sectionPath, moduleObj.exports);
      return moduleObj.exports;
    },
  };
}
