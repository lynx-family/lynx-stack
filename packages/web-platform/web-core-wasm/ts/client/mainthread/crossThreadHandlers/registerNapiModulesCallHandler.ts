// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rpc } from '@lynx-js/web-worker-rpc';
import type { LynxViewInstance } from '../LynxViewInstance.js';
import {
  dispatchNapiModuleEndpoint,
  napiModulesCallEndpoint,
} from '../../endpoints.js';
import type { Cloneable } from '../../../types/index.js';

export function registerNapiModulesCallHandler(
  rpc: Rpc,
  lynxViewInstance: LynxViewInstance,
) {
  const dispatchNapiModules = rpc.createCall(dispatchNapiModuleEndpoint);
  rpc.registerHandler(
    napiModulesCallEndpoint,
    (
      name: string,
      data: Cloneable,
      moduleName: string,
    ) => {
      return lynxViewInstance.parentDom.onNapiModulesCall?.(
        name,
        data,
        moduleName,
        dispatchNapiModules,
      );
    },
  );
}
