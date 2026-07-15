// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function createStreamLogger(scope: string, route: string) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const log = (event: string, details: Record<string, unknown> = {}) => {
    console.info(`[${scope}:stream]`);
    console.dir({
      route,
      requestId,
      event,
      elapsedMs: Date.now() - startedAt,
      ...details,
    }, {
      breakLength: 120,
      depth: null,
      maxArrayLength: null,
      maxStringLength: 20000,
    });
  };

  return { log, requestId };
}
