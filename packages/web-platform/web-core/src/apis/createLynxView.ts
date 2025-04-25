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
import { startUIThread } from '../uiThread/startUIThread.js';
import type { RpcCallType } from '@lynx-js/web-worker-rpc';

export interface LynxViewConfigs {
  templateUrl: string;
  initData: Cloneable;
  globalProps: Cloneable;
  shadowRoot: ShadowRoot;
  callbacks: Parameters<typeof startUIThread>[4];
  nativeModulesMap: NativeModulesMap;
  napiModulesMap: NapiModulesMap;
  tagMap: Record<string, string>;
  lynxGroupId: number | undefined;
}

export interface LynxView {
  updateData(
    data: Cloneable,
    updateDataType: UpdateDataType,
    callback?: () => void,
  ): void;
  dispose(): Promise<void>;
  sendGlobalEvent: RpcCallType<typeof sendGlobalEventEndpoint>;
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
      },
    },
    shadowRoot,
    lynxGroupId,
    callbacks,
  );
}
