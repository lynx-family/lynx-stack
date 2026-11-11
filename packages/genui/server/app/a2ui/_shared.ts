// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Ajv2020 from 'ajv/dist/2020.js';

import type { A2UICatalog } from '../../agent/a2ui/a2ui-catalog.js';
import commonSchema from '../../agent/a2ui/schemas/common_types.json';
import rendererSchema from '../../agent/a2ui/schemas/renderer_to_agent.json';
import type { A2UIChatOptions } from '../../service/a2ui/a2ui-agent.js';
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
  enableDesignGuidance?: boolean;
  catalog?: A2UICatalog;
  maxRepairAttempts?: number;
  validate?: boolean;
}

export interface A2UIActionRequest {
  userMessage?: string;
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
    ...(typeof body.enableDesignGuidance === 'boolean'
      ? { enableDesignGuidance: body.enableDesignGuidance }
      : {}),
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
    if (value.userMessage !== undefined) {
      if (typeof value.userMessage !== 'string') {
        return {
          ok: false,
          status: 400,
          error: 'action.userMessage must be a string',
        };
      }
      action.userMessage = value.userMessage;
    }
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

  return {
    ok: false,
    status: 400,
    error: 'action.name is required',
  };
}

/** Common transport fields accepted alongside v1.0 renderer envelopes. */
export interface A2UIRendererEventBody {
  version?: string;
  surfaceId?: string;
  action?: unknown;
  callAgentFunction?: unknown;
  rendererFunctionResponse?: unknown;
  error?: unknown;
  metadata?: unknown;
  conversation?: unknown;
}

const rendererAjv = new Ajv2020({ strict: false, validateFormats: false });
rendererAjv.addSchema(commonSchema);
rendererAjv.addSchema({
  $id: 'https://a2ui.org/specification/v1_0/catalog.json',
  $defs: {
    anyFunction: { type: 'object', properties: { args: { type: 'object' } } },
  },
});
const validateRendererEnvelope = rendererAjv.compile(rendererSchema);

/** Validate the wire message separately from HTTP transport options. */
export function rendererEventError(
  body: A2UIRendererEventBody,
): string | undefined {
  const envelope = Object.fromEntries(
    Object.entries(body).filter(([key]) =>
      [
        'version',
        'action',
        'callAgentFunction',
        'rendererFunctionResponse',
        'error',
      ].includes(key)
    ),
  );
  return validateRendererEnvelope(envelope)
    ? undefined
    : rendererAjv.errorsText(validateRendererEnvelope.errors);
}

/** Adapt a v1.0 action and transport metadata to the existing stateless service. */
export function normalizeRendererEvent<T extends A2UIRendererEventBody>(
  body: T,
): T & A2UIRendererEventBody {
  const response = body.rendererFunctionResponse;
  const feedback = body.error;
  let action = body.action;
  if (
    action === undefined && isRecord(response)
    && typeof response.functionCallId === 'string'
    && (('value' in response) !== ('error' in response))
  ) {
    action = { name: 'rendererFunctionResponse', context: response };
  } else if (
    action === undefined && isRecord(feedback)
    && typeof feedback.code === 'string' && typeof feedback.message === 'string'
  ) {
    action = { name: 'rendererError', context: feedback };
  }
  const surfaceId =
    isRecord(body.action) && typeof body.action.surfaceId === 'string'
      ? body.action.surfaceId
      : (isRecord(body.error) && typeof body.error.surfaceId === 'string'
        ? body.error.surfaceId
        : body.surfaceId);
  const model = isRecord(body.metadata)
    ? body.metadata.a2uiRendererDataModel
    : undefined;
  const surfaces =
    isRecord(model) && model.version === '1.0' && isRecord(model.surfaces)
      ? model.surfaces
      : undefined;
  return {
    ...body,
    ...(action === undefined ? {} : { action }),
    ...(surfaceId === undefined ? {} : { surfaceId }),
    ...(surfaceId && surfaces && Object.hasOwn(surfaces, surfaceId)
        && (body.conversation === undefined || isRecord(body.conversation))
      ? {
        conversation: {
          ...(isRecord(body.conversation) ? body.conversation : {}),
          dataModel: surfaces[surfaceId],
        },
      }
      : {}),
  };
}

/** The service has no agent-side catalog functions; reject RPCs deterministically. */
export function rejectUnknownAgentFunction(
  body: A2UIRendererEventBody,
): { status: number; body: unknown } | undefined {
  if (body.callAgentFunction === undefined) return undefined;
  const request = body.callAgentFunction;
  if (
    body.version !== '1.0' || body.action !== undefined || !isRecord(request)
    || typeof request.functionCallId !== 'string' || !request.functionCallId
    || typeof request.surfaceId !== 'string' || !request.surfaceId
    || !isRecord(request.callFunction)
    || typeof request.callFunction['@call'] !== 'string'
    || !request.callFunction['@call']
  ) {
    return {
      status: 400,
      body: { ok: false, error: 'Invalid callAgentFunction envelope' },
    };
  }
  const invalidArgs = request.callFunction.args !== undefined
    && !isRecord(request.callFunction.args);
  return {
    status: 200,
    body: {
      ok: true,
      messages: [{
        version: '1.0',
        agentFunctionResponse: {
          functionCallId: request.functionCallId,
          error: {
            code: invalidArgs ? 'INVALID_FUNCTION_CALL' : 'UNKNOWN_FUNCTION',
            message: invalidArgs
              ? 'Function args must be an object'
              : `No agent implementation registered for "${
                request.callFunction['@call']
              }"`,
          },
        },
      }],
    },
  };
}
