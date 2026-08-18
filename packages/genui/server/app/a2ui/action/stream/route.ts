// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import type { A2UICatalog } from '../../../../agent/a2ui-catalog';
import { loadBasicCatalog } from '../../../../agent/a2ui-catalog';
import { createA2UIImageSourcePolicy } from '../../../../agent/a2ui-image-source-policy.js';
import { A2UIProtocolMessageStreamParser } from '../../../../agent/a2ui-stream-parser';
import {
  getA2UIValidationDebugData,
  validateA2UIOutput,
} from '../../../../agent/a2ui-validator';
import {
  createArkImageGenerationRunScope,
  generatedArkImageURLs,
} from '../../../../agent/ark-image-generation-tool.js';
import { getA2UIAgentService } from '../../../../service/a2ui-agent';
import {
  configuredApiStyle,
  defaultModelName,
} from '../../../../service/common/model-config.js';
import type {
  ChatMessage,
  OpenAIReasoningEffort,
} from '../../../../service/common/types';
import {
  MAX_MESSAGE_CHARS,
  validateConversation,
} from '../../../common/chat-validation';
import { jsonWithCors } from '../../../common/cors';
import { errorMessage } from '../../../common/errors';
import {
  checkRateLimit,
  rateLimitSseResponse,
} from '../../../common/rate-limit';
import { readJsonBodyWithLimit } from '../../../common/request';
import { encodeSSE, sseHeaders } from '../../../common/sse';
import { createStreamLogger } from '../../../common/stream-logger';
import { extractUsageMetrics } from '../../../common/usage';
import { pickA2UIChatOptions, validateAction } from '../../_shared';
import { publishA2UIPayload } from '../../payload-publisher';

interface A2UIActionStreamBody {
  conversation?: unknown;
  surfaceId?: string;
  action?: unknown;
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  reasoningEffort?: OpenAIReasoningEffort;
  catalog?: A2UICatalog;
  maxRepairAttempts?: number;
}

async function postA2UIActionStream(req: Request) {
  const { log, requestId } = createStreamLogger(
    'a2ui',
    '/a2ui/action/stream',
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
    return rateLimitSseResponse(req, decision);
  }
  log('rate_limit.accepted', {
    remaining: decision.remaining,
    resetAt: decision.resetAt,
  });

  const parsed = await readJsonBodyWithLimit<A2UIActionStreamBody>(req);
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
  const validatedAction = validateAction(body.action);
  if (!validatedAction.ok) {
    log('action.rejected', {
      durationMs: performance.now() - validationStartedAt,
      error: validatedAction.error,
    });
    return jsonWithCors(
      req,
      { ok: false, error: validatedAction.error },
      { status: validatedAction.status },
    );
  }

  if (!body.surfaceId) {
    log('action.rejected', {
      durationMs: performance.now() - validationStartedAt,
      error: 'surfaceId is required for action responses',
    });
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

  const service = getA2UIAgentService();
  const payload = {
    surfaceId: body.surfaceId,
    action: validatedAction.action,
  };
  const userContent = `A2UI_USER_ACTION: ${JSON.stringify(payload)}`;
  if (userContent.length > MAX_MESSAGE_CHARS) {
    log('action.rejected', {
      durationMs: performance.now() - validationStartedAt,
      error: `synthesized user action exceeds ${MAX_MESSAGE_CHARS} characters`,
      userContentLength: userContent.length,
    });
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

  const opts = {
    ...pickA2UIChatOptions(body),
    onPerformanceEvent: (event: string, details = {}) => {
      log(event, details);
    },
  };
  let catalog: A2UICatalog;
  try {
    catalog = opts.catalog ?? await loadBasicCatalog();
  } catch (err: unknown) {
    const error = errorMessage(err);
    log('catalog.load.failed', error);
    return jsonWithCors(req, { ok: false, error }, { status: 502 });
  }
  const optsWithCatalog = { ...opts, catalog };
  const imageGenerationScope = createArkImageGenerationRunScope();
  const isImageSourceAllowed = createA2UIImageSourcePolicy(
    [[userMessage], validatedConversation.conversation, catalog],
    () => generatedArkImageURLs(imageGenerationScope),
  );
  const validationOptions = {
    requireCreateSurface: false,
    existingSurfaceIds: body.surfaceId ? [body.surfaceId] : [],
    existingDataModelBySurface: body.surfaceId
      ? {
        [body.surfaceId]: validatedConversation.conversation?.dataModel ?? {},
      }
      : {},
    isImageSourceAllowed,
  };

  log('request.accepted', {
    surfaceId: body.surfaceId,
    actionKind: validatedAction.kind,
    actionName: validatedAction.name,
    conversationHistoryCount: validatedConversation.conversation?.history.length
      ?? 0,
    conversationHistoryChars: validatedConversation.conversation?.history
      .reduce((total, message) => total + message.content.length, 0) ?? 0,
    dataModelKeyCount: validatedConversation.conversation
      ? Object.keys(validatedConversation.conversation.dataModel).length
      : 0,
    dataModelChars: validatedConversation.conversation
      ? JSON.stringify(validatedConversation.conversation.dataModel).length
      : 0,
    userContentLength: userContent.length,
    model: opts.model,
    hasBaseURL: Boolean(opts.baseURL),
    catalogId: catalog.id,
    maxRepairAttempts: opts.maxRepairAttempts,
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
            [userMessage],
            optsWithCatalog,
            validatedConversation.conversation,
            generationController.signal,
            imageGenerationScope,
          );
          log('agent.connect.completed', {
            durationMs: performance.now() - connectStartedAt,
          });
          const protocolParser = new A2UIProtocolMessageStreamParser({
            isImageSourceAllowed,
          });
          const streamedMessages: unknown[] = [];
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
            if (!enqueue('delta', { text: chunk })) break;
            const newMessages = protocolParser.push(chunk);
            if (newMessages.length > 0) {
              streamedMessages.push(...newMessages);
              enqueue('message', { messages: newMessages });
              log('protocol.messages', {
                chunkCount,
                newMessageCount: newMessages.length,
                streamedMessageCount: streamedMessages.length,
                streamedTextLength: streamedText.length,
              });
            }
          }

          generationController.signal.throwIfAborted();
          log('upstream.stream.ended', {
            chunkCount,
            streamedTextLength: streamedText.length,
            streamedMessageCount: streamedMessages.length,
          });

          let { text: finalText, usage, finishReason } = await finalize();
          generationController.signal.throwIfAborted();
          let usageMetrics = extractUsageMetrics(usage);
          let cachedTokens = usageMetrics.cachedTokens;
          finalText ??= streamedText;
          log('upstream.finalized', {
            finalTextLength: finalText?.length ?? 0,
            finishReason,
            hasUsage: usage !== undefined,
            catalogId: catalog.id,
            model: opts.model ?? defaultModelName() ?? 'default',
            api: opts.api ?? configuredApiStyle(opts.model) ?? 'default',
            ...usageMetrics,
          });
          let repair:
            | {
              attempted: true;
              sourceErrors: string[];
              ok: boolean;
              attempts: number;
              errors?: string[];
            }
            | undefined;

          let validation: {
            ok: boolean;
            errors: string[];
            warnings: string[];
            messages: unknown[];
          } = {
            ok: false,
            errors: ['no text produced'],
            warnings: [],
            messages: [],
          };
          const v = validateA2UIOutput(
            finalText ?? '',
            catalog,
            validationOptions,
          );
          let validatedMessages = v.ok ? v.messages : [];
          log('validation.completed', {
            ok: v.ok,
            errorCount: v.errors.length,
            errors: v.errors,
            warningCount: v.warnings.length,
            warnings: v.warnings,
            invalidData: v.ok
              ? undefined
              : getA2UIValidationDebugData(finalText ?? '', v.errors),
            messageCount: validatedMessages.length,
          });
          validation = {
            ok: v.ok,
            errors: v.errors,
            warnings: v.warnings,
            messages: validatedMessages,
          };
          if (!v.ok) {
            try {
              log('repair.started', {
                sourceErrors: v.errors,
              });
              const repaired = await service.generateValidated(
                [userMessage],
                optsWithCatalog,
                validatedConversation.conversation,
                validationOptions,
                generationController.signal,
                imageGenerationScope,
              );
              repair = {
                attempted: true,
                sourceErrors: v.errors,
                ok: repaired.ok,
                attempts: repaired.attempts,
              };
              enqueue('repair', repair);
              log('repair.completed', {
                ok: repaired.ok,
                attempts: repaired.attempts,
                errorCount: repaired.errors.length,
                errors: repaired.errors,
                warningCount: repaired.warnings.length,
                warnings: repaired.warnings,
                textLength: repaired.text.length,
                messageCount: repaired.messages.length,
              });
              if (repaired.ok) {
                finalText = repaired.text;
                usage = repaired.usage;
                usageMetrics = extractUsageMetrics(usage);
                cachedTokens = usageMetrics.cachedTokens;
                finishReason = repaired.finishReason;
                validatedMessages = repaired.messages;
                validation = {
                  ok: true,
                  errors: [],
                  warnings: repaired.warnings,
                  messages: validatedMessages,
                };
              } else {
                validation = {
                  ok: false,
                  errors: repaired.errors,
                  warnings: repaired.warnings,
                  messages: [],
                };
              }
            } catch (err: unknown) {
              const repairError = errorMessage(err).message;
              repair = {
                attempted: true,
                sourceErrors: v.errors,
                ok: false,
                attempts: 0,
                errors: [repairError],
              };
              validation = {
                ok: false,
                errors: [repairError],
                warnings: [],
                messages: [],
              };
              enqueue('repair', repair);
              log('repair.error', {
                error: repairError,
              });
            }
          }

          generationController.signal.throwIfAborted();
          const preview = validation.ok
            ? await publishA2UIPayload(validation.messages)
            : undefined;
          generationController.signal.throwIfAborted();

          log('done.enqueued', {
            validationOk: validation.ok,
            validationErrorCount: validation.errors.length,
            messageCount: validation.messages.length,
            hasPreviewUrl: Boolean(preview?.messagesUrl),
            repairAttempted: repair?.attempted ?? false,
            repairOk: repair?.ok,
            catalogId: catalog.id,
            model: opts.model ?? defaultModelName() ?? 'default',
            api: opts.api ?? configuredApiStyle(opts.model) ?? 'default',
            ...usageMetrics,
            requestId,
          });
          enqueue('done', {
            text: finalText,
            usage,
            cachedTokens,
            finishReason,
            validation,
            preview,
            repair,
          });
        } catch (err: unknown) {
          if (!closed && !generationController.signal.aborted) {
            const error = errorMessage(err);
            log('error.enqueued', error);
            enqueue('error', error);
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

const route = new Hono();

route.post('/', (context) => postA2UIActionStream(context.req.raw));

export default route;
