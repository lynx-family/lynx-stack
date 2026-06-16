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
    fetchBundle(url: string) {
      return fetchExternalBundle(url);
    },
    loadScript(sectionPath: string, options: { bundleName: string }) {
      if (!nativeApp.tt) {
        throw new Error(
          `lynx.loadScript: card is not ready while loading section "${sectionPath}".`,
        );
      }
      // `fetchBundle` registered the bundle's raw sections with the worker as
      // bts chunks (updateBTSChunk -> templateCache), so reuse the shared chunk
      // loader to fetch + wrap + run the section to its exports.
      return nativeApp.loadScript(sectionPath, options.bundleName).init({
        tt: nativeApp.tt,
      });
    },
  };
}
