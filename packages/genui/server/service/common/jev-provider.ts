// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readModelConfig } from './model-config.js';
import type { ChatOptions } from './types.js';
import {
  CUSTOM_JEV_BASE_URL,
  isCustomJevBaseURL,
} from '../../agent/common/custom-provider-security.js';

export function resolveJevModel(opts: ChatOptions) {
  if ([opts.model, opts.apiKey, opts.baseURL].every(value => value?.trim())) {
    if (!isCustomJevBaseURL(opts.baseURL!.trim())) return undefined;
    return {
      apiKey: opts.apiKey!.trim(),
      baseURL: CUSTOM_JEV_BASE_URL,
      model: opts.model!.trim(),
      requestScoped: true,
    };
  }
  const result = readModelConfig();
  if (!result.ok) return undefined;
  const config = result.config.models[opts.model ?? '']
    ?? result.config.models[result.config.defaultModel];
  return config?.provider === 'typesafe' ? config : undefined;
}
