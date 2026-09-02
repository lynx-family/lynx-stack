// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import { validateConversation, validateMessages } from './chat-validation.js';
import { jsonWithCors } from './cors.js';
import { errorMessage } from './errors.js';
import { pickProviderOptions } from './provider-options.js';
import { checkRateLimit, rateLimitSseResponse } from './rate-limit.js';
import { readJsonBodyWithLimit } from './request.js';
import { encodeSSE, sseHeaders } from './sse.js';
import { createStreamLogger } from './stream-logger.js';
import type {
  ChatMessage,
  ChatOptions,
  ConversationContext,
} from '../../service/common/types.js';

interface TextChatBody {
  messages?: unknown;
  conversation?: unknown;
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  api?: 'chat' | 'responses';
}

interface TextStreamingService {
  streamAsAsyncIterable(
    messages: ChatMessage[],
    options: ChatOptions,
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
  ): Promise<{
    textStream: AsyncIterable<string>;
    finalize: () => Promise<{
      text: string | undefined;
      usage: unknown;
      finishReason: unknown;
    }>;
  }>;
}

export interface TextStreamRouteOptions {
  scope: string;
  path: string;
  getService: () => TextStreamingService;
  normalizeFinalText?: (value: string) => string;
}

async function postTextStream(req: Request, config: TextStreamRouteOptions) {
  const { log, requestId } = createStreamLogger(config.scope, config.path);
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

  const parsed = await readJsonBodyWithLimit<TextChatBody>(req);
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

  const validationStartedAt = performance.now();
  const validated = validateMessages(parsed.body.messages);
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
  const validatedConversation = validateConversation(parsed.body.conversation);
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
    ...pickProviderOptions(parsed.body),
    onPerformanceEvent: (event: string, details = {}) => {
      log(event, details);
    },
  };
  const service = config.getService();

  log('request.accepted', {
    messageCount: validated.messages.length,
    messageChars: validated.messages.reduce(
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

  let closed = false;
  const generationController = new AbortController();
  const abortGeneration = (reason?: unknown) => {
    if (!generationController.signal.aborted) {
      generationController.abort(reason);
    }
  };
  const onRequestAbort = () => abortGeneration(req.signal.reason);
  if (req.signal.aborted) {
    onRequestAbort();
  } else {
    req.signal.addEventListener('abort', onRequestAbort, { once: true });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let resultMetadata:
        | { finishReason: unknown; usage: unknown }
        | undefined;
      const enqueue = (event: string, data: unknown) => {
        if (closed) return false;
        try {
          controller.enqueue(encodeSSE(event, data));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      const run = async () => {
        try {
          const connectStartedAt = performance.now();
          log('agent.connect.started');
          const { textStream, finalize } = await service.streamAsAsyncIterable(
            validated.messages,
            opts,
            validatedConversation.conversation,
            generationController.signal,
          );
          log('agent.connect.completed', {
            durationMs: performance.now() - connectStartedAt,
          });

          let streamedText = '';
          let chunkCount = 0;
          let firstChunkLogged = false;
          log('upstream.stream.started');

          for await (const chunk of textStream) {
            chunkCount++;
            if (!firstChunkLogged) {
              firstChunkLogged = true;
              log('upstream.first_chunk', {
                durationSinceConnectStartedMs: performance.now()
                  - connectStartedAt,
                chunkLength: chunk.length,
              });
            }
            streamedText += chunk;
            if (!enqueue('delta', { text: chunk })) break;
          }

          generationController.signal.throwIfAborted();
          log('upstream.stream.ended', {
            chunkCount,
            streamedTextLength: streamedText.length,
          });

          const { text, usage, finishReason } = await finalize();
          resultMetadata = { finishReason, usage };
          generationController.signal.throwIfAborted();
          const rawFinalText = text ?? streamedText;
          log('upstream.result.finalized', {
            rawFinalTextLength: rawFinalText.length,
            finishReason,
            usage,
          });
          let finalText: string;
          try {
            finalText = config.normalizeFinalText?.(rawFinalText)
              ?? rawFinalText;
          } catch (error) {
            if (finishReason === 'length') {
              const validationError = errorMessage(error).message;
              throw new Error(
                'Model output reached its token limit before producing a '
                  + `valid final artifact: ${validationError}`,
              );
            }
            throw error;
          }
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
        } catch (error: unknown) {
          if (!closed && !generationController.signal.aborted) {
            const payload = {
              ...errorMessage(error),
              ...(resultMetadata ?? {}),
            };
            log('error.enqueued', payload);
            enqueue('error', payload);
          }
        } finally {
          req.signal.removeEventListener('abort', onRequestAbort);
          if (!closed) {
            closed = true;
            log('stream.closed');
            try {
              controller.close();
            } catch {
              // The reader may have canceled between the state check and close.
            }
          }
        }
      };
      void run();
    },
    cancel(reason) {
      closed = true;
      req.signal.removeEventListener('abort', onRequestAbort);
      abortGeneration(reason);
    },
  });

  return new Response(stream, { status: 200, headers: sseHeaders(req) });
}

export function createTextStreamRoute(
  config: TextStreamRouteOptions,
): Hono {
  const route = new Hono();
  route.post('/', (context) => postTextStream(context.req.raw, config));
  return route;
}
