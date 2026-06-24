// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getOpenUIAgentService } from '../../../service/openui-agent';
import {
  errorMessage,
  pickChatOptions,
  readJsonBodyWithLimit,
  validateConversation,
  validateMessages,
} from '../../a2ui/_shared';
import { corsHeaders, corsPreflight, jsonWithCors } from '../../a2ui/cors';
import { checkRateLimit, rateLimitSseResponse } from '../../a2ui/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OpenUIChatBody {
  messages?: unknown;
  conversation?: unknown;
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  api?: 'chat' | 'responses';
}

function createStreamLogger(route: string) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const log = (event: string, details: Record<string, unknown> = {}) => {
    console.info('[openui:stream]');
    console.dir({
      route,
      requestId,
      event,
      elapsedMs: Date.now() - startedAt,
      ...details,
    }, {
      breakLength: 120,
      depth: null,
      maxArrayLength: null,
      maxStringLength: 20000,
    });
  };

  return { log, requestId };
}

function encodeSSE(event: string, data: unknown): Uint8Array {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return new TextEncoder().encode(`event: ${event}\ndata: ${payload}\n\n`);
}

function sseHeaders(req: Request): Headers {
  return corsHeaders(req, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const { log, requestId } = createStreamLogger('/openui/stream');
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
    ...pickChatOptions(body),
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
