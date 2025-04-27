// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { callLepusMethodEndpoint, type Rpc } from '@lynx-js/web-constants';
import type { MainThreadRuntime } from '../MainThreadRuntime.js';

export function registerCallLepusMethodHandler(
  rpc: Rpc,
  runtime: MainThreadRuntime,
): void {
  rpc.registerHandler(
    callLepusMethodEndpoint,
    (methodName: string, data: unknown) => {
      ((runtime as any)[methodName])(data);
    },
  );
}
