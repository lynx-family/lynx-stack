// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  dispatchCoreContextEventEndpoint,
  DispatchEventResult,
  type Cloneable,
  type LynxContextEventTarget,
  type NativeApp,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { createGetCustomSection } from './crossThreadHandlers/createGetCustomSection.js';
export interface CreateLynxConfig {
  globalProps: unknown;
  customSections: Record<string, Cloneable>;
}

export class LynxCrossThreadContext extends EventTarget
  implements LynxContextEventTarget
{
  constructor(
    private _config: {
      mainThreadRpc: Rpc;
      dispatchEventEndpoint: typeof dispatchCoreContextEventEndpoint;
    },
  ) {
    super();
  }
  postMessage(...args: any[]) {
    console.error('[lynx-web] postMessage not implemented, args:', ...args);
  }
  // @ts-expect-error
  override dispatchEvent(event: Event): number {
    super.dispatchEvent(event);
    return DispatchEventResult.CanceledBeforeDispatch;
  }
  __start() {
    const { mainThreadRpc, dispatchEventEndpoint } = this._config;
    mainThreadRpc.registerHandler(dispatchEventEndpoint, (eventType, data) => {
      this.dispatchEvent(new MessageEvent(eventType, { data: data ?? {} }));
    });
  }
}

export function createBackgroundLynx(
  config: CreateLynxConfig,
  nativeApp: NativeApp,
  mainThreadRpc: Rpc,
) {
  const coreContext = new LynxCrossThreadContext({
    mainThreadRpc,
    dispatchEventEndpoint: dispatchCoreContextEventEndpoint,
  });
  return {
    __globalProps: config.globalProps,
    getJSModule(_moduleName: string): any {
    },
    getNativeApp(): NativeApp {
      return nativeApp;
    },
    getCoreContext() {
      return coreContext;
    },
    getCustomSectionSync(key: string) {
      return config.customSections[key];
    },
    getCustomSection: createGetCustomSection(
      mainThreadRpc,
      config.customSections,
    ),
  };
}
