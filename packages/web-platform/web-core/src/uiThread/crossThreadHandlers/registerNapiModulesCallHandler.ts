// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rpc } from '@lynx-js/web-worker-rpc';
import {
  dispatchNapiModuleEndpoint,
  napiModulesCallEndpoint,
  type Cloneable,
  type NapiModulesCall,
} from '@lynx-js/web-constants';

export function registerNapiModulesCallHandler(
  rpc: Rpc,
  napiModulesCall: NapiModulesCall,
) {
  const dispatchNapiModules = rpc.createCall(dispatchNapiModuleEndpoint);
  rpc.registerHandler(
    napiModulesCallEndpoint,
    (
      name: string,
      data: Cloneable,
      moduleName: string,
    ) => {
      return napiModulesCall(
        name,
        data,
        moduleName,
        dispatchNapiModules,
      );
    },
  );
}
