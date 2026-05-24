// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { A2UICatalog } from '../../../agent/a2ui-catalog';
import { getA2UIAgentService } from '../../../service/a2ui-agent';
import type { ChatMessage } from '../../../service/a2ui-agent';
import {
  MAX_MESSAGE_CHARS,
  errorMessage,
  pickChatOptions,
  readJsonBodyWithLimit,
  validateConversation,
} from '../_shared';
import { corsPreflight, jsonWithCors } from '../cors';
import { checkRateLimit, rateLimitJsonResponse } from '../rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface A2UIActionBody {
  conversation?: unknown;
  surfaceId?: string;
  action: {
    name: string;
    context?: Record<string, unknown>;
  };
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  catalog?: A2UICatalog;
  maxRepairAttempts?: number;
}

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
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

  if (!body.action || !body.action.name) {
    return jsonWithCors(
      req,
      { ok: false, error: 'action.name is required' },
      { status: 400 },
    );
  }

  if (!body.surfaceId) {
    return jsonWithCors(
      req,
      {
        ok: false,
        error: 'surfaceId is required for action responses',
      },
      { status: 400 },
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
    surfaceId: body.surfaceId,
    action: body.action,
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

  const opts = pickChatOptions(body);
  try {
    const validated = await service.generateValidated(
      [userMessage],
      opts,
      validatedConversation.conversation,
      {
        requireCreateSurface: false,
        existingSurfaceIds: body.surfaceId ? [body.surfaceId] : [],
      },
    );
    return jsonWithCors(req, validated);
  } catch (err: unknown) {
    const { message, name } = errorMessage(err);
    return jsonWithCors(req, { ok: false, error: message, name });
  }
}
