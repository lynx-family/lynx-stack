// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { z } from 'zod';

import type { A2UICatalog } from '../../agent/a2ui-catalog';
import { A2UIExtensionsMetadataSchema } from '../../agent/a2ui-validator';
import type { A2UIChatOptions } from '../../service/a2ui-agent';
import type { OpenAIReasoningEffort } from '../../service/common/types';
import { pickProviderOptions } from '../common/provider-options';

export interface A2UIChatBody {
  messages?: unknown;
  conversation?: unknown;
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  api?: 'chat' | 'responses';
  reasoningEffort?: OpenAIReasoningEffort;
  catalog?: A2UICatalog;
  maxRepairAttempts?: number;
  validate?: boolean;
}

export interface A2UIActionRequest {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string;
  context: Record<string, unknown>;
  userMessage?: string;
  metadata?: {
    extensions?: Record<string, unknown>;
  };
}

const V1ActionSchema = z
  .object({
    name: z.string().min(1),
    surfaceId: z.string().min(1),
    sourceComponentId: z.string().min(1),
    timestamp: z.iso.datetime({ offset: true }),
    context: z.record(z.string(), z.unknown()),
    userMessage: z.string().optional(),
    metadata: A2UIExtensionsMetadataSchema.optional(),
  })
  .strict();

export interface ValidatedAction {
  ok: true;
  action: A2UIActionRequest;
  kind: 'v1.0' | 'legacy';
  name: string;
}

export function pickA2UIChatOptions(body: A2UIChatBody): A2UIChatOptions {
  return {
    ...pickProviderOptions(body),
    catalog: body.catalog,
    maxRepairAttempts: body.maxRepairAttempts,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateAction(
  value: unknown,
  envelope: {
    version?: unknown;
    surfaceId?: unknown;
  } = {},
):
  | ValidatedAction
  | { ok: false; status: number; error: string }
{
  if (envelope.version !== undefined && envelope.version !== 'v1.0') {
    return {
      ok: false,
      status: 400,
      error: 'version must be "v1.0"',
    };
  }
  if (!isRecord(value)) {
    return {
      ok: false,
      status: 400,
      error: 'action.name is required',
    };
  }

  if (typeof value.name !== 'string' || value.name.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'action.name is required',
    };
  }

  if (envelope.version === 'v1.0') {
    const parsed = V1ActionSchema.safeParse(value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue !== undefined && issue.path.length > 0
        ? `action.${issue.path.join('.')}`
        : 'action';
      return {
        ok: false,
        status: 400,
        error: `${path}: ${issue?.message ?? 'invalid v1.0 action'}`,
      };
    }
    return {
      ok: true,
      action: parsed.data,
      kind: 'v1.0',
      name: parsed.data.name,
    };
  }

  if (
    typeof envelope.surfaceId !== 'string' || envelope.surfaceId.length === 0
  ) {
    return {
      ok: false,
      status: 400,
      error: 'surfaceId is required for legacy action responses',
    };
  }
  if ('context' in value && !isRecord(value.context)) {
    return {
      ok: false,
      status: 400,
      error: 'action.context must be an object',
    };
  }

  const action: A2UIActionRequest = {
    name: value.name,
    surfaceId: envelope.surfaceId,
    sourceComponentId: 'legacy',
    timestamp: new Date().toISOString(),
    context: isRecord(value.context) ? value.context : {},
  };
  return {
    ok: true,
    action,
    kind: 'legacy',
    name: value.name,
  };
}
