// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  nativeModulesCallEndpoint,
  switchExposureService,
  type Cloneable,
  type NativeModulesMap,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export async function createNativeModules(
  rpc: Rpc,
  nativeModulesMap: NativeModulesMap,
): Promise<Record<string, any>> {
  const switchExposure = rpc.createCall(switchExposureService);
  const nativeModulesCall = rpc.createCall(nativeModulesCallEndpoint);
  const lynxExposureModule = {
    resumeExposure() {
      switchExposure(true, true);
    },
    stopExposure(param: { sendEvent?: boolean }) {
      switchExposure(false, param.sendEvent ?? true);
    },
  };
  const bridgeModule = {
    call(
      name: string,
      data: Cloneable,
      callback: (ret: Cloneable) => void,
    ): void {
      nativeModulesCall(name, data, 'bridge').then(callback);
    },
  };

  const nativeModules = {};
  const customNativeModules: Record<string, Record<string, any>> = {};
  await Promise.all(
    Object.entries(nativeModulesMap).map((
      [moduleName, moduleStr],
    ) =>
      import(/* webpackIgnore: true */ moduleStr).then(
        module =>
          customNativeModules[moduleName] = module?.default?.(
            nativeModules,
            (name: string, data: Cloneable) =>
              nativeModulesCall(name, data, moduleName),
          ),
      )
    ),
  );

  return Object.assign(nativeModules, {
    bridge: bridgeModule,
    LynxExposureModule: lynxExposureModule,
    ...customNativeModules,
  });
}
