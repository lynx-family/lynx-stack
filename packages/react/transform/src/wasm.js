// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { instantiateNapiModuleSync } from '@emnapi/core';
import { getDefaultContext } from '@emnapi/runtime';

// alias in `rslib.config.mts`
// eslint-disable-next-line import/no-unresolved
import bytes from '#react_transform.wasm';

const mod = new WebAssembly.Module(bytes);

const { instance, napiModule } = instantiateNapiModuleSync(mod, {
  context: getDefaultContext(),
  overwriteImports(importObject) {
    importObject.env = {
      ...importObject.env,
      ...importObject.napi,
      ...importObject.emnapi,
    };

    importObject.getrandom = {
      random_fill_sync: function(offset, size) {
        const view = new Uint8Array(
          instance.exports.memory.buffer,
          offset,
          size,
        );
        for (let i = 0; i < view.length; i++) {
          view[i] = Math.floor(Math.random() * 256);
        }
      },
    };

    return importObject;
  },
});

export default napiModule.exports;
