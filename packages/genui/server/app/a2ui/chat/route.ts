// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getA2UIAgentService } from '../../../service/a2ui-agent';
import {
  errorMessage,
  pickChatOptions,
  readJsonBodyWithLimit,
  validateConversation,
  validateMessages,
} from '../_shared';
import type { A2UIChatBody } from '../_shared';
import { corsPreflight, jsonWithCors } from '../cors';
import { checkRateLimit, rateLimitJsonResponse } from '../rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const opts = pickChatOptions(body);

  try {
    if (body.validate === false) {
      const { text, usage, finishReason } = await service.generateRaw(
        messages,
        opts,
        validatedConversation.conversation,
      );
      return jsonWithCors(req, { ok: true, text, usage, finishReason });
    }

    const validatedResult = await service.generateValidated(
      messages,
      opts,
      validatedConversation.conversation,
    );
    return jsonWithCors(req, validatedResult);
  } catch (err: unknown) {
    const { message, name } = errorMessage(err);
    return jsonWithCors(req, { ok: false, error: message, name });
  }
}
