// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { A2UICatalog } from '../../agent/a2ui-catalog';
import type { ChatOptions } from '../../service/a2ui-agent';

export interface A2UIChatBody {
  messages?: unknown;
  threadId?: string;
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  catalog?: A2UICatalog;
  maxRepairAttempts?: number;
  validate?: boolean;
}

function clientOverridesAllowed(): boolean {
  return process.env['A2UI_ALLOW_CLIENT_OVERRIDE'] === '1';
}

export function pickChatOptions(body: {
  threadId?: string;
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  catalog?: A2UICatalog;
  maxRepairAttempts?: number;
}): ChatOptions {
  const allowOverride = clientOverridesAllowed();
  return {
    threadId: body.threadId,
    resourceId: body.resourceId,
    model: body.model,
    apiKey: allowOverride ? body.apiKey : undefined,
    baseURL: allowOverride ? body.baseURL : undefined,
    catalog: body.catalog,
    maxRepairAttempts: body.maxRepairAttempts,
  };
}

export function errorMessage(
  err: unknown,
): { message: string; name?: string } {
  if (err instanceof Error) return { message: err.message, name: err.name };
  return { message: String(err) };
}
