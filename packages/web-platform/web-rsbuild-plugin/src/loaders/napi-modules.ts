// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LoaderContext } from 'webpack';
import { pathToFileURL } from 'node:url';

interface NativeModulesLoaderOptions {
  napiModulesPath: string;
}

export default function(
  this: LoaderContext<NativeModulesLoaderOptions>,
  source: string,
) {
  const options = this.getOptions();
  const { napiModulesPath } = options;
  const modifiedSource = source.replace(
    /\/\* LYNX_NAPI_MODULES_IMPORT \*\//g,
    `import CUSTOM_NAPI_MODULES from ${
      JSON.stringify(pathToFileURL(napiModulesPath))
    };`,
  ).replace(
    /\/\* LYNX_NAPI_MODULES_ADD \*\//g,
    `Object.entries(CUSTOM_NAPI_MODULES).map(([moduleName, moduleFunc]) => {
  napiModules[moduleName] = moduleFunc(
    napiModules,
    (name, data) => napiModulesCall(name, data, moduleName),
    (func) => {
      rpc.registerHandler(dispatchNapiModuleEndpoint, (data) => func(data));
    },
  );
});`,
  );

  return modifiedSource;
}
