/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Rpc } from '@lynx-js/web-worker-rpc';
import type {
  Cloneable,
  InitI18nResources,
  JSRealm,
  NapiModulesMap,
  NativeModulesMap,
  WorkerStartMessage,
} from '@types';
import { systemInfoBase } from '@constants';
import { BackgroundThread } from './Background.js';
import { createIFrameRealm } from './createIFrameRealm.js';
import { I18nManager } from './I18n.js';

const pixelRatio = window.devicePixelRatio;
const screenWidth = window.screen.availWidth * pixelRatio;
const screenHeight = window.screen.availHeight * pixelRatio;
export const systemInfo = Object.freeze({
  ...systemInfoBase,
  // some information only available on main thread, we should read and pass to worker
  pixelRatio,
  screenWidth,
  screenHeight,
});

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
    new URL('../background/index.js', import.meta.url),
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

  private btsRpc: Rpc;
  private lynxGroupId?: number;
  private webWorker: Worker;
  private backgroundThread: BackgroundThread;

  readonly i18nManager: I18nManager;
  lepusCodeUrls?: Record<string, string>;
  mtsRealm?: JSRealm;

  constructor(
    public readonly globalprops: Cloneable,
    public readonly templateUrl: string,
    private readonly rootDom: ShadowRoot,
    lynxGroupId: number | undefined,
    initI18nResources?: InitI18nResources,
  ) {
    // start the main-thread first
    createIFrameRealm(this.rootDom).then((realm) => {
      this.mtsRealm = realm;
    });

    // now start the background worker
    if (lynxGroupId !== undefined) {
      this.lynxGroupId = lynxGroupId;
      const group = LynxViewInstance.contextIdToBackgroundWorker[lynxGroupId];
      if (group) {
        group.runningCards += 1;
      } else {
        LynxViewInstance.contextIdToBackgroundWorker[lynxGroupId] = {
          worker: createWebWorker(),
          runningCards: 1,
        };
      }
      this.webWorker = LynxViewInstance.contextIdToBackgroundWorker[
        lynxGroupId
      ]!.worker;
    } else {
      this.webWorker = createWebWorker();
    }
    const messageChannel = new MessageChannel();
    this.webWorker.postMessage(
      {
        mainThreadMessagePort: messageChannel.port1,
        systemInfo,
      } as WorkerStartMessage,
      [messageChannel.port2],
    );
    this.btsRpc = new Rpc(messageChannel.port1, 'ui-to-bg');
    this.backgroundThread = new BackgroundThread(this.btsRpc);
    this.i18nManager = new I18nManager(
      this.backgroundThread,
      this.rootDom,
      initI18nResources,
    );
  }

  reportError(error: Error, release: string, fileName: string) {
    this.rootDom.dispatchEvent(
      new CustomEvent('error', {
        detail: {
          sourceMap: {
            offset: {
              line: 2,
              col: 0,
            },
          },
          error,
          release,
          fileName,
        },
      }),
    );
  }

  async [Symbol.asyncDispose]() {
    await this.backgroundThread[Symbol.asyncDispose]();
    if (this.lynxGroupId !== undefined) {
      const group =
        LynxViewInstance.contextIdToBackgroundWorker[this.lynxGroupId];
      if (group) {
        group.runningCards -= 1;
        if (group.runningCards === 0) {
          group.worker.terminate();
          LynxViewInstance.contextIdToBackgroundWorker[
            this.lynxGroupId
          ] = undefined;
        }
      }
    } else {
      this.webWorker?.terminate();
    }
  }
}
