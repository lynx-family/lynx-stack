// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { redactModelConfigSecrets } from '../../service/common/model-config.js';

const MAX_REASONING_CHARS = 64_000;

/** Request-local diagnostics: include only on failed responses, never in logs. */
export function createFailureReasoning(
  secrets: readonly (string | undefined)[],
) {
  let text = '';
  let truncated = false;
  return {
    append: (chunk: string) => {
      const remaining = MAX_REASONING_CHARS - text.length;
      text += chunk.slice(0, remaining);
      truncated ||= chunk.length > remaining;
    },
    payload(): { reasoning?: { text: string; truncated: boolean } } {
      const redacted = redactModelConfigSecrets(text, secrets).trim();
      return redacted
        ? {
          reasoning: {
            text: redacted.slice(0, MAX_REASONING_CHARS),
            truncated: truncated || redacted.length > MAX_REASONING_CHARS,
          },
        }
        : {};
    },
  };
}
