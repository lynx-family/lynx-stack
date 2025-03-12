// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/// <reference types="vitest/globals" />

import { EventEmitter } from 'node:events';

export function createStubLynx(vi, require, replaceStyleSheetByIdWithBase64) {
  const emitter = new EventEmitter();
  return {
    requireModuleAsync: vi.fn(
      (
        path,
        callback,
      ) => {
        try {
          callback(null, require(path));
        } catch (err) {
          callback(err);
        }
      },
    ),
    getJSContext: vi.fn().mockReturnValue({
      addEventListener(event, callback) {
        return emitter.addListener(event, callback);
      },
    }),
    getCoreContext: vi.fn().mockReturnValue({
      dispatchEvent({ type, data }) {
        return emitter.emit(type, { data });
      },
    }),
    getDevtool: vi.fn().mockReturnValue({
      replaceStyleSheetByIdWithBase64,
    }),
    __chunk_entries__: {},
  };
}
