// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getLynxXmlAgentService } from '../../../service/lynx-xml-agent';
import {
  validateConversation,
  validateMessages,
} from '../../common/chat-validation';
import { corsPreflight, jsonWithCors } from '../../common/cors';
import { errorMessage } from '../../common/errors';
import { pickProviderOptions } from '../../common/provider-options';
import { checkRateLimit, rateLimitJsonResponse } from '../../common/rate-limit';
import { readJsonBodyWithLimit } from '../../common/request';
import { createStreamLogger } from '../../common/stream-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LynxXmlChatBody {
  messages?: unknown;
  conversation?: unknown;
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  api?: 'chat' | 'responses';
}

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const { log, requestId } = createStreamLogger(
    'lynx-xml',
    '/lynx-xml/stream',
  );
  log('request.received', {
    contentLength: req.headers.get('content-length'),
  });

  const decision = checkRateLimit(req);
  if (!decision.ok) {
    log('rate_limit.rejected', {
      retryAfterSec: decision.retryAfterSec,
      remaining: decision.remaining,
      resetAt: decision.resetAt,
    });
    return rateLimitJsonResponse(req, decision);
  }

  const parsed = await readJsonBodyWithLimit<LynxXmlChatBody>(req);
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
  const validatedConversation = validateConversation(body.conversation);
  if (!validatedConversation.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: validatedConversation.error },
      { status: validatedConversation.status },
    );
  }

  const opts = {
    ...pickProviderOptions(body),
    onPerformanceEvent: (event: string, details = {}) => {
      log(event, details);
    },
  };
  const service = getLynxXmlAgentService();

  log('request.accepted', {
    messageCount: validated.messages.length,
    conversationHistoryCount: validatedConversation.conversation?.history
      .length ?? 0,
    model: opts.model,
    hasBaseURL: Boolean(opts.baseURL),
  });

  try {
    const generated = await service.generateValidated(
      validated.messages,
      opts,
      validatedConversation.conversation,
      req.signal,
    );
    if (!generated.ok) {
      throw new Error(
        `Generated Lynx XML is invalid after ${generated.attempts} attempts: ${
          generated.errors.join('; ')
        }`,
      );
    }

    log('response.validated', {
      finalTextLength: generated.text.length,
      finishReason: generated.finishReason,
      hasUsage: generated.usage !== undefined,
      attempts: generated.attempts,
      requestId,
    });
    return jsonWithCors(req, {
      ok: true,
      text: generated.text,
      usage: generated.usage,
      finishReason: generated.finishReason,
      attempts: generated.attempts,
    });
  } catch (error: unknown) {
    const normalizedError = errorMessage(error);
    log('response.failed', normalizedError);
    return jsonWithCors(
      req,
      {
        ok: false,
        error: normalizedError.message,
        name: normalizedError.name,
      },
      { status: 500 },
    );
  }
}
