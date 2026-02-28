// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  callLepusMethodEndpoint,
  type MainThreadGlobalThis,
  type Rpc,
} from '@lynx-js/web-constants';

/**
 * Registers a handler for calling Main Thread Script (MTS) methods.
 *
 * @remarks
 * "Lepus" in the function name is a legacy term for Main Thread Script (MTS).
 */
export function registerCallLepusMethodHandler(
  rpc: Rpc,
  runtime: MainThreadGlobalThis,
): void {
  rpc.registerHandler(
    callLepusMethodEndpoint,
    (methodName: string, data: unknown) => {
      ((runtime as any)[methodName])(data);
    },
  );
}
