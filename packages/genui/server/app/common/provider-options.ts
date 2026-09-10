// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { configuredModelName } from '../../service/common/model-config.js';
import type {
  ChatOptions,
  OpenAIReasoningEffort,
} from '../../service/common/types';

export interface ProviderOptionsBody {
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  api?: 'chat' | 'responses';
  reasoningEffort?: OpenAIReasoningEffort;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function pickProviderOptions(body: ProviderOptionsBody): ChatOptions {
  const model = nonEmptyString(body.model);
  const apiKey = nonEmptyString(body.apiKey);
  const baseURL = nonEmptyString(body.baseURL);
  const hasCompleteCustomProvider = model !== undefined
    && apiKey !== undefined
    && baseURL !== undefined;
  return {
    resourceId: body.resourceId,
    model: hasCompleteCustomProvider ? model : configuredModelName(model),
    apiKey: hasCompleteCustomProvider ? apiKey : undefined,
    baseURL: hasCompleteCustomProvider ? baseURL : undefined,
    api: hasCompleteCustomProvider ? body.api : undefined,
    reasoningEffort: hasCompleteCustomProvider
      ? body.reasoningEffort
      : undefined,
    disableAgentCache: hasCompleteCustomProvider ? true : undefined,
  };
}
