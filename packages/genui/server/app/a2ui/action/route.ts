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
} from '../_shared';
import { corsPreflight, jsonWithCors } from '../cors';
import { checkRateLimit, rateLimitJsonResponse } from '../rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface A2UIActionBody {
  threadId: string;
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
  reset?: boolean;
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

  if (!body || !body.threadId) {
    return jsonWithCors(req, { ok: false, error: 'threadId is required' });
  }
  if (!body.action || !body.action.name) {
    return jsonWithCors(req, {
      ok: false,
      error: 'action.name is required',
    });
  }

  const service = getA2UIAgentService();

  if (body.reset) {
    service.resetConversation(body.threadId);
  }

  const conv = service.peekConversation(body.threadId);
  if (!conv && !body.reset) {
    return jsonWithCors(req, {
      ok: false,
      error: `unknown threadId "${body.threadId}" - call /a2ui/chat first`,
    });
  }

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
    const validated = await service.generateValidated([userMessage], opts);
    return jsonWithCors(req, validated);
  } catch (err: unknown) {
    const { message, name } = errorMessage(err);
    return jsonWithCors(req, { ok: false, error: message, name });
  }
}
