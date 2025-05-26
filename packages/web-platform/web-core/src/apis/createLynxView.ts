// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  Cloneable,
  NapiModulesMap,
  NativeModulesMap,
  sendGlobalEventEndpoint,
  UpdateDataType,
} from '@lynx-js/web-constants';
import {
  startUIThread,
  type StartUIThreadCallbacks,
} from '../uiThread/startUIThread.js';
import type { RpcCallType } from '@lynx-js/web-worker-rpc';
const pixelRatio = window.devicePixelRatio;
const screenWidth = window.screen.availWidth * pixelRatio;
const screenHeight = window.screen.availHeight * pixelRatio;

export interface LynxViewConfigs {
  templateUrl: string;
  initData: Cloneable;
  globalProps: Cloneable;
  shadowRoot: ShadowRoot;
  callbacks: StartUIThreadCallbacks;
  nativeModulesMap: NativeModulesMap;
  napiModulesMap: NapiModulesMap;
  tagMap: Record<string, string>;
  lynxGroupId: number | undefined;
  threadStrategy: 'all-on-ui' | 'multi-thread';
}

export interface LynxView {
  updateData(
    data: Cloneable,
    updateDataType: UpdateDataType,
    callback?: () => void,
  ): void;
  dispose(): Promise<void>;
  sendGlobalEvent: RpcCallType<typeof sendGlobalEventEndpoint>;
  updateGlobalProps: (data: Cloneable) => void;
}

export function createLynxView(configs: LynxViewConfigs): LynxView {
  const {
    shadowRoot,
    callbacks,
    templateUrl,
    globalProps,
    initData,
    nativeModulesMap,
    napiModulesMap,
    tagMap,
    lynxGroupId,
    threadStrategy = 'multi-thread',
  } = configs;
  return startUIThread(
    templateUrl,
    {
      tagMap,
      initData,
      globalProps,
      nativeModulesMap,
      napiModulesMap,
      browserConfig: {
        pixelRatio: window.devicePixelRatio,
        pixelWidth: screenWidth,
        pixelHeight: screenHeight,
      },
    },
    shadowRoot,
    lynxGroupId,
    threadStrategy,
    callbacks,
  );
}
