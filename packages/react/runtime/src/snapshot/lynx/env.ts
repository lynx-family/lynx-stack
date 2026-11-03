// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { setupSharedLynxEnv } from '../../core/lynx/env.js';

export function setupLynxEnv(): void {
  setupSharedLynxEnv();

  if (__LEPUS__) {
    lynx.reportError = function(e: Error | string) {
      const error = e instanceof Error ? e : new Error(JSON.stringify(e));
      _ReportError(error, {
        errorCode: 1101, // ErrCode::LYNX_ERROR_CODE_LEPUS in Lynx/base/debug/error_code.h
      });
    };
  }
}
