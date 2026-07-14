// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UICatalog } from '../../agent/a2ui-catalog';
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
  context?: Record<string, unknown>;
}

export interface ValidatedAction {
  ok: true;
  action: A2UIActionRequest;
  kind: 'event' | 'functionCall';
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

export function validateAction(value: unknown):
  | ValidatedAction
  | { ok: false; status: number; error: string }
{
  if (!isRecord(value)) {
    return {
      ok: false,
      status: 400,
      error: 'action.name is required',
    };
  }

  if (typeof value.name === 'string' && value.name.length > 0) {
    const action: A2UIActionRequest = { name: value.name };
    if ('context' in value) {
      if (!isRecord(value.context)) {
        return {
          ok: false,
          status: 400,
          error: 'action.context must be an object',
        };
      }
      action.context = value.context;
    }
    return {
      ok: true,
      action,
      kind: 'event',
      name: value.name,
    };
  }

  const hasEvent = 'event' in value;
  const hasFunctionCall = 'functionCall' in value;

  if (hasEvent && hasFunctionCall) {
    return {
      ok: false,
      status: 400,
      error: 'exactly one of action.event or action.functionCall is required',
    };
  }

  if (hasEvent && isRecord(value.event)) {
    const name = value.event.name;
    if (typeof name === 'string' && name.length > 0) {
      const action: A2UIActionRequest = { name };
      if ('context' in value.event) {
        if (!isRecord(value.event.context)) {
          return {
            ok: false,
            status: 400,
            error: 'action.event.context must be an object',
          };
        }
        action.context = value.event.context;
      }
      return {
        ok: true,
        action,
        kind: 'event',
        name,
      };
    }
  }

  if (hasFunctionCall && isRecord(value.functionCall)) {
    const call = value.functionCall.call;
    if (typeof call === 'string' && call.length > 0) {
      const action: A2UIActionRequest = { name: call };
      if ('args' in value.functionCall) {
        if (!isRecord(value.functionCall.args)) {
          return {
            ok: false,
            status: 400,
            error: 'action.functionCall.args must be an object',
          };
        }
        action.context = value.functionCall.args;
      }
      return {
        ok: true,
        action,
        kind: 'functionCall',
        name: call,
      };
    }
  }

  return {
    ok: false,
    status: 400,
    error: 'action.name is required',
  };
}
