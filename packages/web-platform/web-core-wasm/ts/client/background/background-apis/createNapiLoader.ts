// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* LYNX_NAPI_MODULES_IMPORT */
import {
  dispatchNapiModuleEndpoint,
  napiModulesCallEndpoint,
} from '../../endpoints.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import type { Cloneable, NapiModulesMap } from '../../../types/index.js';

export const createNapiLoader = async (
  rpc: Rpc,
  napiModulesMap: NapiModulesMap,
) => {
  const napiModulesCall = rpc.createCall(napiModulesCallEndpoint);
  const napiModules: Record<string, Record<string, any>> = {};
  await Promise.all(
    Object.entries(napiModulesMap).map((
      [moduleName, moduleStr],
    ) =>
      import(/* webpackIgnore: true */ moduleStr).then(
        module =>
          napiModules[moduleName] = module?.default?.(
            napiModules,
            (name: string, data: Cloneable) =>
              napiModulesCall(name, data, moduleName),
            (func: (data: unknown) => void) => {
              rpc.registerHandler(dispatchNapiModuleEndpoint, (data) =>
                func(data));
            },
          ),
      )
    ),
  );
  /* LYNX_NAPI_MODULES_ADD */

  return {
    load(moduleName: string) {
      return napiModules[moduleName];
    },
  };
};
