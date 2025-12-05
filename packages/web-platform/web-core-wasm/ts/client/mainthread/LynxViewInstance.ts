/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Rpc, RpcCallType } from '@lynx-js/web-worker-rpc';
import type {
  Cloneable,
  InitI18nResources,
  NapiModulesMap,
  NativeModulesMap,
} from '@types';
import type { sendGlobalEventEndpoint } from '@client/endpoints.js';

export interface LynxViewConfigs {
  templateUrl: string;
  initData: Cloneable;
  globalProps: Cloneable;
  shadowRoot: ShadowRoot;
  nativeModulesMap: NativeModulesMap;
  napiModulesMap: NapiModulesMap;
  tagMap: Record<string, string>;
  lynxGroupId: number | undefined;
  initI18nResources: InitI18nResources;
}

function createWebWorker(): Worker {
  return new Worker(
    /* webpackFetchPriority: "high" */
    /* webpackChunkName: "web-core-worker-runtime" */
    /* webpackPrefetch: true */
    /* webpackPreload: true */
    new URL('@lynx-js/web-worker-runtime', import.meta.url),
    {
      type: 'module',
      name: 'lynx-bg',
    },
  );
}

export class LynxViewInstance implements AsyncDisposable {
  static contextIdToBackgroundWorker: ({
    worker: Worker;
    runningCards: number;
  } | undefined)[] = [];

  #btsRpc: Rpc;
  #lynxGroupId?: number;
  #webWorker: Worker;

  constructor(configs: LynxViewConfigs) {
    if (configs.lynxGroupId !== undefined) {
      this.#lynxGroupId = configs.lynxGroupId;
      const group =
        LynxViewInstance.contextIdToBackgroundWorker[configs.lynxGroupId];
      if (group) {
        group.runningCards += 1;
      } else {
        LynxViewInstance.contextIdToBackgroundWorker[configs.lynxGroupId] = {
          worker: createWebWorker(),
          runningCards: 1,
        };
      }
      this.#webWorker = LynxViewInstance.contextIdToBackgroundWorker[
        configs.lynxGroupId
      ]!.worker;
    } else {
      this.#webWorker = createWebWorker();
    }
  }

  async [Symbol.asyncDispose]() {
    if (this.#lynxGroupId !== undefined) {
      const group =
        LynxViewInstance.contextIdToBackgroundWorker[this.#lynxGroupId];
      if (group) {
        group.runningCards -= 1;
        if (group.runningCards === 0) {
          group.worker.terminate();
          LynxViewInstance.contextIdToBackgroundWorker[
            this.#lynxGroupId
          ] = undefined;
        }
      }
    } else {
      this.#webWorker?.terminate();
    }
  }
}
