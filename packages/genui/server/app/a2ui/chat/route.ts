// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getA2UIAgentService } from '../../../service/a2ui-agent';
import type { ChatMessage } from '../../../service/a2ui-agent';
import { errorMessage, pickChatOptions } from '../_shared';
import type { A2UIChatBody } from '../_shared';
import { corsPreflight, jsonWithCors } from '../cors';
import { checkRateLimit, rateLimitJsonResponse } from '../rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isChatMessageArray(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) =>
      item !== null
      && typeof item === 'object'
      && typeof (item as ChatMessage).role === 'string'
      && typeof (item as ChatMessage).content === 'string',
  );
}

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const decision = checkRateLimit(req);
  if (!decision.ok) {
    return rateLimitJsonResponse(req, decision);
  }

  let body: A2UIChatBody;
  try {
    body = (await req.json()) as A2UIChatBody;
  } catch {
    return jsonWithCors(
      req,
      { ok: false, error: 'invalid JSON body' },
      { status: 400 },
    );
  }

  if (!isChatMessageArray(body.messages)) {
    return jsonWithCors(
      req,
      { ok: false, error: 'messages is required' },
      { status: 400 },
    );
  }
  const messages = body.messages;

  const service = getA2UIAgentService();
  const opts = pickChatOptions(body);

  try {
    if (body.validate === false) {
      const { text, usage, finishReason } = await service.generateRaw(
        messages,
        opts,
      );
      return jsonWithCors(req, { ok: true, text, usage, finishReason });
    }

    const validated = await service.generateValidated(messages, opts);
    return jsonWithCors(req, validated);
  } catch (err: unknown) {
    const { message, name } = errorMessage(err);
    return jsonWithCors(req, { ok: false, error: message, name });
  }
}
