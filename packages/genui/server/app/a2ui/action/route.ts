// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Hono } from 'hono';

import type { A2UICatalog } from '../../../agent/a2ui-catalog';
import { getA2UIAgentService } from '../../../service/a2ui-agent';
import type { ChatMessage } from '../../../service/common/types';
import {
  MAX_MESSAGE_CHARS,
  validateConversation,
} from '../../common/chat-validation';
import { jsonWithCors } from '../../common/cors';
import { errorMessage } from '../../common/errors';
import { checkRateLimit, rateLimitJsonResponse } from '../../common/rate-limit';
import { readJsonBodyWithLimit } from '../../common/request';
import { pickA2UIChatOptions, validateAction } from '../_shared';

interface A2UIActionBody {
  version?: unknown;
  conversation?: unknown;
  surfaceId?: unknown;
  action?: unknown;
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  catalog?: A2UICatalog;
  maxRepairAttempts?: number;
}

async function postA2UIAction(req: Request) {
  const decision = checkRateLimit(req);
  if (!decision.ok) {
    return rateLimitJsonResponse(req, decision);
  }

  const parsed = await readJsonBodyWithLimit<A2UIActionBody>(req);
  if (!parsed.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: parsed.error },
      { status: parsed.status },
    );
  }
  const body = parsed.body;

  const validatedAction = validateAction(body.action, {
    version: body.version,
    surfaceId: body.surfaceId,
  });
  if (!validatedAction.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: validatedAction.error },
      { status: validatedAction.status },
    );
  }

  const validatedConversation = validateConversation(body.conversation);
  if (!validatedConversation.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: validatedConversation.error },
      { status: validatedConversation.status },
    );
  }

  const service = getA2UIAgentService();
  const payload = {
    version: 'v1.0',
    action: validatedAction.action,
  };
  const userContent = `A2UI_USER_ACTION: ${JSON.stringify(payload)}`;
  if (userContent.length > MAX_MESSAGE_CHARS) {
    return jsonWithCors(
      req,
      {
        ok: false,
        error:
          `synthesized user action exceeds ${MAX_MESSAGE_CHARS} characters`,
      },
      { status: 413 },
    );
  }
  const userMessage: ChatMessage = {
    role: 'user',
    content: userContent,
  };

  const opts = pickA2UIChatOptions(body);
  try {
    const validated = await service.generateValidated(
      [userMessage],
      opts,
      validatedConversation.conversation,
      {
        requireCreateSurface: false,
        existingSurfaceIds: [validatedAction.action.surfaceId],
        existingDataModelBySurface: {
          [validatedAction.action.surfaceId]: validatedConversation
            .conversation?.dataModel ?? {},
        },
      },
      req.signal,
    );
    return jsonWithCors(req, validated);
  } catch (err: unknown) {
    const { message, name } = errorMessage(err);
    return jsonWithCors(req, { ok: false, error: message, name });
  }
}

const route = new Hono();

route.post('/', (context) => postA2UIAction(context.req.raw));

export default route;
