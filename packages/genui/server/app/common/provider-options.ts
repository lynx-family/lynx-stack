// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

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

export function clientOverridesAllowed(): boolean {
  return process.env.A2UI_ALLOW_CLIENT_OVERRIDE === '1';
}

export function pickProviderOptions(body: ProviderOptionsBody): ChatOptions {
  const allowOverride = clientOverridesAllowed();
  return {
    resourceId: body.resourceId,
    model: allowOverride ? body.model : undefined,
    apiKey: allowOverride ? body.apiKey : undefined,
    baseURL: allowOverride ? body.baseURL : undefined,
    api: allowOverride ? body.api : undefined,
    reasoningEffort: allowOverride ? body.reasoningEffort : undefined,
  };
}
