/*
 * Copyright (C) 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Rpc, type RpcCallType } from '@lynx-js/web-worker-rpc';
import {
  dispatchCoreContextOnBackgroundEndpoint,
  dispatchJSContextOnMainThreadEndpoint,
  disposeEndpoint,
  markTimingEndpoint,
  postTimingFlagsEndpoint,
  publicComponentEventEndpoint,
  publishEventEndpoint,
  sendGlobalEventEndpoint,
  dispatchI18nResourceEndpoint,
  updateDataEndpoint,
  updateGlobalPropsEndpoint,
  BackgroundThreadStartEndpoint,
  callLepusMethodEndpoint,
  switchExposureServiceEndpoint,
  reportErrorEndpoint,
  dispatchLynxViewEventEndpoint,
  updateBTSChunkEndpoint,
  queryComponentEndpoint,
} from '../endpoints.js';
import type {
  Cloneable,
  NapiModulesMap,
  NativeModulesMap,
  TimingEntry,
  WorkerStartMessage,
} from '../../types/index.js';
import { LynxCrossThreadContext } from '../LynxCrossThreadContext.js';
import { systemInfo, type LynxViewInstance } from './LynxViewInstance.js';
import { registerInvokeUIMethodHandler } from './crossThreadHandlers/registerInvokeUIMethodHandler.js';
import { registerNativePropsHandler } from './crossThreadHandlers/registerSetNativePropsHandler.js';
import { registerGetPathInfoHandler } from './crossThreadHandlers/registerGetPathInfoHandler.js';
import { registerSelectComponentHandler } from './crossThreadHandlers/registerSelectComponentHandler.js';
import { registerTriggerComponentEventHandler } from './crossThreadHandlers/registerTriggerComponentEventHandler.js';
import { registerTriggerElementMethodEndpointHandler } from './crossThreadHandlers/registerTriggerElementMethodEndpointHandler.js';
import { registerNapiModulesCallHandler } from './crossThreadHandlers/registerNapiModulesCallHandler.js';
import { registerNativeModulesCallHandler } from './crossThreadHandlers/registerNativeModulesCallHandler.js';
import { registerReloadHandler } from './crossThreadHandlers/registerReloadHandler.js';

function createWebWorker(): Worker {
  return new Worker(
    /* webpackFetchPriority: "high" */
    /* webpackChunkName: "web-core-worker-chunk" */
    /* webpackPrefetch: true */
    /* webpackPreload: true */
    new URL('../background/index.js', import.meta.url),
    {
      type: 'module',
      name: 'lynx-bg',
    },
  );
}
export class BackgroundThread implements AsyncDisposable {
  static contextIdToBackgroundWorker: ({
    worker: Worker;
    runningCards: number;
  } | undefined)[] = [];

  #rpc: Rpc;
  #webWorker?: Worker;
  #nextMacroTask: ReturnType<typeof setTimeout> | null = null;
  #caughtTimingInfo: TimingEntry[] = [];
  #batchSendTimingInfo: RpcCallType<typeof markTimingEndpoint>;

  readonly jsContext: LynxCrossThreadContext;

  readonly postTimingFlags: RpcCallType<typeof postTimingFlagsEndpoint>;
  readonly sendGlobalEvent: RpcCallType<typeof sendGlobalEventEndpoint>;
  readonly publicComponentEvent: RpcCallType<
    typeof publicComponentEventEndpoint
  >;
  readonly publishEvent: RpcCallType<typeof publishEventEndpoint>;
  readonly dispatchI18nResource: RpcCallType<
    typeof dispatchI18nResourceEndpoint
  >;
  readonly updateData: RpcCallType<typeof updateDataEndpoint>;
  readonly updateGlobalProps: RpcCallType<typeof updateGlobalPropsEndpoint>;
  readonly updateBTSChunk: RpcCallType<typeof updateBTSChunkEndpoint>;

  readonly #lynxGroupId: number | undefined;
  readonly #lynxViewInstance: LynxViewInstance;

  readonly #btsReady: Promise<void>;

  #btsReadyResolver!: () => void;

  #btsStarted = false;

  constructor(
    lynxGroupId: number | undefined,
    lynxViewInstance: LynxViewInstance,
  ) {
    this.#lynxGroupId = lynxGroupId;
    this.#lynxViewInstance = lynxViewInstance;
    this.#rpc = new Rpc(undefined, 'main-to-bg');
    this.jsContext = new LynxCrossThreadContext({
      rpc: this.#rpc,
      receiveEventEndpoint: dispatchJSContextOnMainThreadEndpoint,
      sendEventEndpoint: dispatchCoreContextOnBackgroundEndpoint,
    });
    this.#btsReady = new Promise((resolve) => {
      this.#btsReadyResolver = resolve;
    });
    this.jsContext.__start();
    this.#batchSendTimingInfo = this.#rpc.createCall(markTimingEndpoint);
    this.postTimingFlags = this.#rpc.createCall(postTimingFlagsEndpoint);
    this.sendGlobalEvent = this.#rpc.createCall(sendGlobalEventEndpoint);
    this.publicComponentEvent = this.#rpc.createCall(
      publicComponentEventEndpoint,
    );
    this.publishEvent = this.#rpc.createCall(publishEventEndpoint);
    this.dispatchI18nResource = this.#rpc.createCall(
      dispatchI18nResourceEndpoint,
    );
    this.updateData = this.#rpc.createCall(updateDataEndpoint);
    this.updateGlobalProps = this.#rpc.createCall(updateGlobalPropsEndpoint);
    this.updateBTSChunk = this.#rpc.createCall(updateBTSChunkEndpoint);
  }

  startWebWorker(
    initData: Cloneable,
    globalProps: Cloneable,
    cardType: string,
    customSections: Record<string, Cloneable>,
    nativeModulesMap: NativeModulesMap,
    napiModulesMap: NapiModulesMap,
  ) {
    if (this.#webWorker) return;
    // now start the background worker
    if (this.#lynxGroupId !== undefined) {
      const group =
        BackgroundThread.contextIdToBackgroundWorker[this.#lynxGroupId];
      if (group) {
        group.runningCards += 1;
      } else {
        BackgroundThread.contextIdToBackgroundWorker[this.#lynxGroupId] = {
          worker: createWebWorker(),
          runningCards: 1,
        };
      }
      this.#webWorker = BackgroundThread.contextIdToBackgroundWorker[
        this.#lynxGroupId
      ]!.worker;
    } else {
      this.#webWorker = createWebWorker();
    }
    const messageChannel = new MessageChannel();
    this.#webWorker.postMessage(
      {
        mainThreadMessagePort: messageChannel.port2,
        systemInfo,
        initData,
        globalProps,
        cardType,
        customSections,
        nativeModulesMap,
        napiModulesMap,
        entryTemplateUrl: this.#lynxViewInstance.templateUrl,
      } as WorkerStartMessage,
      [messageChannel.port2],
    );
    this.#rpc.setMessagePort(messageChannel.port1);
  }

  startBTS() {
    if (this.#btsStarted) return;
    this.#btsStarted = true;
    // prepare bts rpc handlers
    this.#rpc.registerHandler(
      callLepusMethodEndpoint,
      (methodName: string, data: unknown) => {
        const method = (
          this.#lynxViewInstance.mainThreadGlobalThis as any
        )[methodName];
        if (typeof method === 'function') {
          method.call(this.#lynxViewInstance.mainThreadGlobalThis, data);
        } else {
          console.error(
            `Method ${methodName} not found on mainThreadGlobalThis`,
          );
        }
      },
    );

    this.#rpc.registerHandler(
      switchExposureServiceEndpoint,
      this.#lynxViewInstance.exposureServices.switchExposureService.bind(
        this.#lynxViewInstance.exposureServices,
      ),
    );

    this.#rpc.registerHandler(
      reportErrorEndpoint,
      (e, _, release) => {
        this.#lynxViewInstance.reportError(
          e,
          release,
          'app-service.js',
        );
      },
    );
    this.#rpc.registerHandler(
      dispatchLynxViewEventEndpoint,
      (eventType, detail) => {
        this.#lynxViewInstance.rootDom.dispatchEvent(
          new CustomEvent(eventType, {
            detail,
            bubbles: true,
            cancelable: true,
            composed: true,
          }),
        );
      },
    );
    this.#rpc.registerHandler(
      queryComponentEndpoint,
      (url: string) => {
        return this.#lynxViewInstance.queryComponent(url).then(() => {
          this.jsContext.dispatchEvent({
            type: '__OnDynamicJSSourcePrepared',
            data: url,
          });
          return {
            code: 0,
            detail: {
              schema: url,
            },
          };
        });
      },
    );
    registerReloadHandler(this.#rpc, this.#lynxViewInstance);
    registerGetPathInfoHandler(this.#rpc, this.#lynxViewInstance);
    registerInvokeUIMethodHandler(this.#rpc, this.#lynxViewInstance);
    registerNapiModulesCallHandler(this.#rpc, this.#lynxViewInstance);
    registerNativeModulesCallHandler(this.#rpc, this.#lynxViewInstance);
    registerSelectComponentHandler(this.#rpc, this.#lynxViewInstance);
    registerNativePropsHandler(this.#rpc, this.#lynxViewInstance);
    registerTriggerComponentEventHandler(this.#rpc, this.#lynxViewInstance);
    registerTriggerElementMethodEndpointHandler(
      this.#rpc,
      this.#lynxViewInstance,
    );

    this.#rpc.invoke(BackgroundThreadStartEndpoint, []).then(
      this.#btsReadyResolver,
    );
  }

  markTiming(
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
  ): void {
    this.#caughtTimingInfo.push({
      timingKey,
      pipelineId,
      timeStamp: timeStamp ?? (performance.now() + performance.timeOrigin),
    });
    if (this.#nextMacroTask === null) {
      this.#nextMacroTask = setTimeout(() => {
        this.flushTimingInfo();
      }, 500);
    }
  }

  /**
   * Flush the timing info immediately.
   */
  flushTimingInfo(): void {
    this.#batchSendTimingInfo(this.#caughtTimingInfo);
    this.#caughtTimingInfo = [];
    if (this.#nextMacroTask !== null) {
      clearTimeout(this.#nextMacroTask);
      this.#nextMacroTask = null;
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.#btsReady;
    /*
     * TODO:
     * Potential deadlock if startBTS() was never called.
     * If [Symbol.asyncDispose]() is invoked on a BackgroundThread instance where startBTS() was never called,
     * #btsReady will never resolve, causing the disposal to hang indefinitely.
     * Consider guarding with the existing #btsStarted flag.
     */
    await this.#rpc.invoke(disposeEndpoint, []);
    if (this.#lynxGroupId !== undefined) {
      const group =
        BackgroundThread.contextIdToBackgroundWorker[this.#lynxGroupId];
      if (group) {
        group.runningCards -= 1;
        if (group.runningCards === 0) {
          group.worker.terminate();
          BackgroundThread.contextIdToBackgroundWorker[
            this.#lynxGroupId
          ] = undefined;
        }
      }
    } else {
      this.#webWorker?.terminate();
    }
    this.#nextMacroTask && clearTimeout(this.#nextMacroTask);
  }
}
