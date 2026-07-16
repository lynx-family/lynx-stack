// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getOpenUIAgentService } from '../../../service/openui-agent';
import {
  validateConversation,
  validateMessages,
} from '../../common/chat-validation';
import { corsPreflight, jsonWithCors } from '../../common/cors';
import { errorMessage } from '../../common/errors';
import { pickProviderOptions } from '../../common/provider-options';
import { checkRateLimit, rateLimitSseResponse } from '../../common/rate-limit';
import { readJsonBodyWithLimit } from '../../common/request';
import { encodeSSE, sseHeaders } from '../../common/sse';
import { createStreamLogger } from '../../common/stream-logger';

interface OpenUIChatBody {
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
  const { log, requestId } = createStreamLogger('openui', '/openui/stream');
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
    return rateLimitSseResponse(req, decision);
  }
  log('rate_limit.accepted', {
    remaining: decision.remaining,
    resetAt: decision.resetAt,
  });

  const parsed = await readJsonBodyWithLimit<OpenUIChatBody>(req);
  log(parsed.ok ? 'body.parsed' : 'body.rejected', {
    ...parsed.metrics,
    error: parsed.ok ? undefined : parsed.error,
  });
  if (!parsed.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: parsed.error },
      { status: parsed.status },
    );
  }
  const body = parsed.body;

  const validationStartedAt = performance.now();
  const validated = validateMessages(body.messages);
  if (!validated.ok) {
    log('messages.rejected', {
      durationMs: performance.now() - validationStartedAt,
      error: validated.error,
    });
    return jsonWithCors(
      req,
      { ok: false, error: validated.error },
      { status: validated.status },
    );
  }
  const messages = validated.messages;
  const validatedConversation = validateConversation(body.conversation);
  if (!validatedConversation.ok) {
    log('conversation.rejected', {
      durationMs: performance.now() - validationStartedAt,
      error: validatedConversation.error,
    });
    return jsonWithCors(
      req,
      { ok: false, error: validatedConversation.error },
      { status: validatedConversation.status },
    );
  }
  log('request.validated', {
    durationMs: performance.now() - validationStartedAt,
  });

  const opts = {
    ...pickProviderOptions(body),
    onPerformanceEvent: (event: string, details = {}) => {
      log(event, details);
    },
  };
  const service = getOpenUIAgentService();

  log('request.accepted', {
    messageCount: messages.length,
    messageChars: messages.reduce(
      (total, message) => total + message.content.length,
      0,
    ),
    conversationHistoryCount: validatedConversation.conversation?.history.length
      ?? 0,
    conversationHistoryChars: validatedConversation.conversation?.history
      .reduce((total, message) => total + message.content.length, 0) ?? 0,
    dataModelKeyCount: validatedConversation.conversation
      ? Object.keys(validatedConversation.conversation.dataModel).length
      : 0,
    model: opts.model,
    hasBaseURL: Boolean(opts.baseURL),
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        controller.enqueue(encodeSSE(event, data));
      };

      try {
        const connectStartedAt = performance.now();
        log('agent.connect.started');
        const { textStream, finalize } = await service.streamAsAsyncIterable(
          messages,
          opts,
          validatedConversation.conversation,
        );
        log('agent.connect.completed', {
          durationMs: performance.now() - connectStartedAt,
        });

        let streamedText = '';
        let chunkCount = 0;
        let firstChunkLogged = false;

        log('upstream.stream.started');

        for await (const chunk of textStream) {
          chunkCount += 1;
          if (!firstChunkLogged) {
            firstChunkLogged = true;
            log('upstream.first_chunk', {
              durationSinceConnectStartedMs: performance.now()
                - connectStartedAt,
              chunkLength: chunk.length,
            });
          }
          streamedText += chunk;
          enqueue('delta', { text: chunk });
        }

        log('upstream.stream.ended', {
          chunkCount,
          streamedTextLength: streamedText.length,
        });

        const { text, usage, finishReason } = await finalize();
        const finalText = text ?? streamedText;
        log('done.enqueued', {
          finalTextLength: finalText.length,
          finishReason,
          hasUsage: usage !== undefined,
          requestId,
        });
        enqueue('done', {
          ok: true,
          text: finalText,
          usage,
          finishReason,
        });
      } catch (err: unknown) {
        const error = errorMessage(err);
        log('error.enqueued', error);
        enqueue('error', error);
      } finally {
        log('stream.closed');
        controller.close();
      }
    },
  });

  return new Response(stream, { status: 200, headers: sseHeaders(req) });
}
