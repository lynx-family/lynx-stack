// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { type NapiLoaderCall, type NativeApp } from '@lynx-js/web-constants';

export const createNapiLoader = async (
  napiLoaderUrl: NapiLoaderCall,
  nativeApp: NativeApp,
) => {
  const napiLoaderCall: Record<string, any> = {};
  for (
    const [moduleName, moduleString] of Object.entries(
      napiLoaderUrl,
    )
  ) {
    napiLoaderCall[moduleName] = (await import(
      /* webpackIgnore: true */ moduleString
    ))?.default;
  }
  recursiveFunctionCallBinder(
    napiLoaderCall,
    nativeApp.nativeModuleProxy,
  );
  (globalThis as any)['napiLoaderOnRT' + nativeApp.id] = {
    load(moduleName: string) {
      return napiLoaderCall[moduleName];
    },
  };
};

function recursiveFunctionCallBinder(
  napiLoaderCall: Record<string, Record<string, any>>,
  nativeModules: any,
): Record<string, Record<string, any>> {
  const newObj = Object.fromEntries(
    Object.entries(napiLoaderCall).map(([loaderName, loaderImpl]) => {
      if (typeof loaderImpl === 'object') {
        for (const [property, value] of Object.entries(loaderImpl)) {
          if (
            typeof value === 'function'
          ) {
            // Class && Function: support `this.nativeModules` to call nativeModules
            if (value?.prototype?.constructor === value) {
              value.prototype.nativeModules = nativeModules;
            }
            loaderImpl[property] = value.bind({ nativeModules });
          }
        }
      }
      return [loaderName, loaderImpl];
    }),
  );

  return newObj;
}
