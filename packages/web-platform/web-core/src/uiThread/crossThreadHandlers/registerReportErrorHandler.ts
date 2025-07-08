// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { reportErrorEndpoint } from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function registerReportErrorHandler(
  rpc: Rpc,
  fileName: string,
  onError?: (e: Error, release: string, fileName: string) => void,
) {
  rpc.registerHandler(
    reportErrorEndpoint,
    (e, _, release) => {
      onError?.(e, release, fileName);
    },
  );
}
