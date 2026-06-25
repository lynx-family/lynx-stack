// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UICatalog } from '../../../../agent/a2ui-catalog';
import { loadBasicCatalog } from '../../../../agent/a2ui-catalog';
import {
  A2UIProtocolMessageStreamParser,
  splitA2UIProtocolMessages,
} from '../../../../agent/a2ui-stream-parser';
import {
  getA2UIValidationDebugData,
  validateA2UIOutput,
} from '../../../../agent/a2ui-validator';
import {
  replacePendingA2UIImagesWithLoading,
  resolveA2UIImageUrlsIncrementally,
  resolveStaticA2UIImageComponent,
} from '../../../../agent/image-resolver';
import { getA2UIAgentService } from '../../../../service/a2ui-agent';
import type {
  ChatMessage,
  OpenAIReasoningEffort,
} from '../../../../service/a2ui-agent';
import {
  MAX_MESSAGE_CHARS,
  errorMessage,
  extractUsageMetrics,
  pickChatOptions,
  readJsonBodyWithLimit,
  validateAction,
  validateConversation,
} from '../../_shared';
import { corsHeaders, corsPreflight, jsonWithCors } from '../../cors';
import { publishA2UIPayload } from '../../payload-publisher';
import { checkRateLimit, rateLimitSseResponse } from '../../rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function createStreamLogger(route: string) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const log = (event: string, details: Record<string, unknown> = {}) => {
    console.info('[a2ui:stream]');
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
  const { log, requestId } = createStreamLogger('/a2ui/action/stream');
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
    ...pickChatOptions(body),
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        controller.enqueue(encodeSSE(event, data));
      };
      const resolveMessagesForStreaming = async (
        messages: Parameters<typeof resolveA2UIImageUrlsIncrementally>[0],
      ) => {
        const pendingImages = replacePendingA2UIImagesWithLoading(messages);
        if (pendingImages.replacementCount > 0) {
          const loadingMessages = splitA2UIProtocolMessages(
            pendingImages.messages,
          );
          enqueue('message', { messages: loadingMessages });
          log('images.loading.enqueued', {
            replacementCount: pendingImages.replacementCount,
            messageCount: loadingMessages.length,
          });
        }

        const resolvedMessages = await resolveA2UIImageUrlsIncrementally(
          messages,
          (imageMessages) => {
            if (imageMessages.length === 0) return;
            enqueue('message', { messages: imageMessages });
            log('images.resolved.enqueued', {
              messageCount: imageMessages.length,
            });
          },
        );
        return resolvedMessages;
      };

      try {
        const connectStartedAt = performance.now();
        log('agent.connect.started');
        const { textStream, finalize } = await service.streamAsAsyncIterable(
          [userMessage],
          optsWithCatalog,
          validatedConversation.conversation,
        );
        log('agent.connect.completed', {
          durationMs: performance.now() - connectStartedAt,
        });
        const streamingImageResolutions: Promise<void>[] = [];
        const streamingImageKeys = new Set<string>();
        const protocolParser = new A2UIProtocolMessageStreamParser({
          onStaticImageComponent: (surfaceId, component) => {
            if (typeof component.url !== 'string') return;
            const key = `${surfaceId}\0${component.id}\0${component.url}`;
            if (streamingImageKeys.has(key)) return;
            streamingImageKeys.add(key);
            const resolution = resolveStaticA2UIImageComponent(
              surfaceId,
              component,
            ).then((message) => {
              if (!message) return;
              enqueue('message', { messages: [message] });
              log('images.resolved.enqueued', {
                messageCount: 1,
                streaming: true,
              });
            }).catch((err: unknown) => {
              log('images.resolved.error', {
                streaming: true,
                error: errorMessage(err).message,
              });
            });
            streamingImageResolutions.push(resolution);
          },
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
          enqueue('delta', { text: chunk });
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

        log('upstream.stream.ended', {
          chunkCount,
          streamedTextLength: streamedText.length,
          streamedMessageCount: streamedMessages.length,
        });

        await Promise.allSettled(streamingImageResolutions);

        let { text: finalText, usage, finishReason } = await finalize();
        let usageMetrics = extractUsageMetrics(usage);
        let cachedTokens = usageMetrics.cachedTokens;
        finalText ??= streamedText;
        log('upstream.finalized', {
          finalTextLength: finalText?.length ?? 0,
          finishReason,
          hasUsage: usage !== undefined,
          catalogId: catalog.id,
          model: opts.model ?? process.env.OPENAI_MODEL ?? 'default',
          api: opts.api ?? process.env.OPENAI_API_STYLE ?? 'default',
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
        const validationOptions = {
          requireCreateSurface: false,
          existingSurfaceIds: body.surfaceId ? [body.surfaceId] : [],
          existingDataModelBySurface: body.surfaceId
            ? {
              [body.surfaceId]: validatedConversation.conversation?.dataModel
                ?? {},
            }
            : {},
        };
        const v = validateA2UIOutput(
          finalText ?? '',
          catalog,
          validationOptions,
        );
        let resolvedMessages = v.ok
          ? await resolveMessagesForStreaming(v.messages)
          : [];
        log('validation.completed', {
          ok: v.ok,
          errorCount: v.errors.length,
          errors: v.errors,
          warningCount: v.warnings.length,
          warnings: v.warnings,
          invalidData: v.ok
            ? undefined
            : getA2UIValidationDebugData(finalText ?? '', v.errors),
          resolvedMessageCount: resolvedMessages.length,
        });
        validation = {
          ok: v.ok,
          errors: v.errors,
          warnings: v.warnings,
          messages: resolvedMessages,
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
              resolvedMessages = await resolveMessagesForStreaming(
                repaired.messages,
              );
              validation = {
                ok: true,
                errors: [],
                warnings: repaired.warnings,
                messages: resolvedMessages,
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

        const preview = validation.ok
          ? await publishA2UIPayload(validation.messages)
          : undefined;

        log('done.enqueued', {
          validationOk: validation.ok,
          validationErrorCount: validation.errors.length,
          messageCount: validation.messages.length,
          hasPreviewUrl: Boolean(preview?.messagesUrl),
          repairAttempted: repair?.attempted ?? false,
          repairOk: repair?.ok,
          catalogId: catalog.id,
          model: opts.model ?? process.env.OPENAI_MODEL ?? 'default',
          api: opts.api ?? process.env.OPENAI_API_STYLE ?? 'default',
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
