// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { pathToFileURL } from 'node:url';

import type { LoaderContext } from 'webpack';

interface NativeModulesLoaderOptions {
  nativeModulesPath: string;
}

export default function(
  this: LoaderContext<NativeModulesLoaderOptions>,
  source: string,
) {
  const options = this.getOptions();
  const { nativeModulesPath } = options;
  const modifiedSource = source.replace(
    /\/\* LYNX_NATIVE_MODULES_IMPORT \*\//g,
    `import CUSTOM_NATIVE_MODULES from ${
      JSON.stringify(pathToFileURL(nativeModulesPath))
    };`,
  ).replace(
    /\/\* LYNX_NATIVE_MODULES_ADD \*\//g,
    `Object.entries(CUSTOM_NATIVE_MODULES).map(([moduleName, moduleFunc]) => {
    customNativeModules[moduleName] = moduleFunc(
      nativeModules,
      (name, data) =>
        nativeModulesCall(name, data, moduleName),
    );
  });`,
  );

  return modifiedSource;
}
