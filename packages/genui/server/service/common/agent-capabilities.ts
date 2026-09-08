// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { buildResourceRunOptions, pickProviderConfig } from './provider.js';
import type { ChatOptions } from './types.js';
import { createSearchRunScope } from '../../agent/common/doubao-search-tool.js';

export function pickSearchAgentConfig(opts: ChatOptions) {
  return {
    ...pickProviderConfig(opts),
    enableWebSearch: opts.enableWebSearch,
  };
}

/** Each invocation owns its search budget, even when the Agent is cached. */
export function buildSearchRunOptions(
  opts: ChatOptions,
  abortSignal?: AbortSignal,
) {
  return {
    ...buildResourceRunOptions(opts, abortSignal),
    ...createSearchRunScope(),
  };
}
