// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getA2UIAgentService } from '../../../service/a2ui-agent';
import {
  validateConversation,
  validateMessages,
} from '../../common/chat-validation';
import { corsPreflight, jsonWithCors } from '../../common/cors';
import { errorMessage } from '../../common/errors';
import { checkRateLimit, rateLimitJsonResponse } from '../../common/rate-limit';
import { readJsonBodyWithLimit } from '../../common/request';
import { extractUsageMetrics } from '../../common/usage';
import { pickA2UIChatOptions } from '../_shared';
import type { A2UIChatBody } from '../_shared';

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const decision = checkRateLimit(req);
  if (!decision.ok) {
    return rateLimitJsonResponse(req, decision);
  }

  const parsed = await readJsonBodyWithLimit<A2UIChatBody>(req);
  if (!parsed.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: parsed.error },
      { status: parsed.status },
    );
  }
  const body = parsed.body;

  const validated = validateMessages(body.messages);
  if (!validated.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: validated.error },
      { status: validated.status },
    );
  }
  const messages = validated.messages;
  const validatedConversation = validateConversation(body.conversation);
  if (!validatedConversation.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: validatedConversation.error },
      { status: validatedConversation.status },
    );
  }

  const service = getA2UIAgentService();
  const opts = pickA2UIChatOptions(body);

  try {
    if (body.validate === false) {
      const { text, usage, finishReason } = await service.generateRaw(
        messages,
        opts,
        validatedConversation.conversation,
      );
      return jsonWithCors(req, {
        ok: true,
        text,
        usage,
        cachedTokens: extractUsageMetrics(usage).cachedTokens,
        finishReason,
      });
    }

    const validatedResult = await service.generateValidated(
      messages,
      opts,
      validatedConversation.conversation,
    );
    return jsonWithCors(req, {
      ...validatedResult,
      cachedTokens: extractUsageMetrics(validatedResult.usage).cachedTokens,
    });
  } catch (err: unknown) {
    const { message, name } = errorMessage(err);
    return jsonWithCors(req, { ok: false, error: message, name });
  }
}
