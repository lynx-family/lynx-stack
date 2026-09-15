// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { redactModelConfigSecrets } from '../../service/common/model-config.js';
import { GenerationUpstreamError } from '../../service/common/result.js';

export interface ErrorMessageOptions {
  secrets?: readonly (string | undefined)[];
}

export function errorMessage(
  err: unknown,
  options: ErrorMessageOptions = {},
): {
  message: string;
  name?: string;
  statusCode?: number;
  upstreamRequestId?: string;
} {
  const redact = (value: string) =>
    redactModelConfigSecrets(value, options.secrets);
  if (err instanceof Error) {
    return {
      message: redact(err.message),
      name: redact(err.name),
      ...(err instanceof GenerationUpstreamError
        ? {
          ...(err.statusCode === undefined
            ? {}
            : { statusCode: err.statusCode }),
          ...(err.upstreamRequestId === undefined ? {} : {
            upstreamRequestId: redact(err.upstreamRequestId),
          }),
        }
        : {}),
    };
  }
  return { message: redact(String(err)) };
}
