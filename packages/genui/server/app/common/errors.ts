// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { redactModelConfigSecrets } from '../../service/common/model-config.js';

export function errorMessage(
  err: unknown,
): { message: string; name?: string } {
  if (err instanceof Error) {
    return {
      message: redactModelConfigSecrets(err.message),
      name: redactModelConfigSecrets(err.name),
    };
  }
  return { message: redactModelConfigSecrets(String(err)) };
}
