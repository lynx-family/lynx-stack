// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BASIC_CATALOG } from '../../../agent/a2ui-catalog';
import {
  A2UIProtocolMessageStreamParser,
  splitA2UIProtocolMessages,
} from '../../../agent/a2ui-stream-parser';
import {
  getA2UIValidationDebugData,
  validateA2UIOutput,
} from '../../../agent/a2ui-validator';
import { resolveA2UIImageUrls } from '../../../agent/image-resolver';
import { getA2UIAgentService } from '../../../service/a2ui-agent';
import {
  errorMessage,
  pickChatOptions,
  readJsonBodyWithLimit,
  validateConversation,
  validateMessages,
} from '../_shared';
import type { A2UIChatBody } from '../_shared';
import { corsHeaders, corsPreflight, jsonWithCors } from '../cors';
import { checkRateLimit, rateLimitSseResponse } from '../rate-limit';

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
  const decision = checkRateLimit(req);
  if (!decision.ok) {
    return rateLimitSseResponse(req, decision);
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
  const opts = pickChatOptions(body);
  const service = getA2UIAgentService();
  const { log, requestId } = createStreamLogger('/a2ui/stream');

  log('request.accepted', {
    messageCount: messages.length,
    conversationHistoryCount: validatedConversation.conversation?.history.length
      ?? 0,
    dataModelKeyCount: validatedConversation.conversation
      ? Object.keys(validatedConversation.conversation.dataModel).length
      : 0,
    model: opts.model,
    hasBaseURL: Boolean(opts.baseURL),
    catalogId: opts.catalog?.id ?? BASIC_CATALOG.id,
    maxRepairAttempts: opts.maxRepairAttempts,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        controller.enqueue(encodeSSE(event, data));
      };

      try {
        const { textStream, finalize } = await service.streamAsAsyncIterable(
          messages,
          opts,
          validatedConversation.conversation,
        );
        const protocolParser = new A2UIProtocolMessageStreamParser();
        const streamedMessages: unknown[] = [];
        let streamedText = '';
        let chunkCount = 0;

        log('upstream.stream.started');

        for await (const chunk of textStream) {
          chunkCount += 1;
          streamedText += chunk;
          enqueue('delta', { text: chunk });
          const newMessages = protocolParser.push(chunk);
          if (newMessages.length > 0) {
            streamedMessages.push(...newMessages);
            enqueue('message', { messages: streamedMessages });
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

        let { text: finalText, usage, finishReason } = await finalize();
        finalText ??= streamedText;
        log('upstream.finalized', {
          finalTextLength: finalText?.length ?? 0,
          finishReason,
          hasUsage: usage !== undefined,
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

        let validation: { ok: boolean; errors: string[]; messages: unknown[] } =
          {
            ok: false,
            errors: ['no text produced'],
            messages: [],
          };
        const v = validateA2UIOutput(
          finalText ?? '',
          opts.catalog ?? BASIC_CATALOG,
        );
        let resolvedMessages = v.ok
          ? splitA2UIProtocolMessages(await resolveA2UIImageUrls(v.messages))
          : [];
        log('validation.completed', {
          ok: v.ok,
          errorCount: v.errors.length,
          errors: v.errors,
          invalidData: v.ok
            ? undefined
            : getA2UIValidationDebugData(finalText ?? '', v.errors),
          resolvedMessageCount: resolvedMessages.length,
        });
        validation = {
          ok: v.ok,
          errors: v.errors,
          messages: resolvedMessages,
        };
        if (!v.ok) {
          try {
            log('repair.started', {
              sourceErrors: v.errors,
            });
            const repaired = await service.generateValidated(
              messages,
              opts,
              validatedConversation.conversation,
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
              textLength: repaired.text.length,
              messageCount: repaired.messages.length,
            });
            if (repaired.ok) {
              finalText = repaired.text;
              usage = repaired.usage;
              finishReason = repaired.finishReason;
              resolvedMessages = splitA2UIProtocolMessages(
                await resolveA2UIImageUrls(repaired.messages),
              );
              validation = {
                ok: true,
                errors: [],
                messages: resolvedMessages,
              };
            } else {
              validation = {
                ok: false,
                errors: repaired.errors,
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
              messages: [],
            };
            enqueue('repair', repair);
            log('repair.error', {
              error: repairError,
            });
          }
        }

        log('done.enqueued', {
          validationOk: validation.ok,
          validationErrorCount: validation.errors.length,
          messageCount: validation.messages.length,
          repairAttempted: repair?.attempted ?? false,
          repairOk: repair?.ok,
          requestId,
        });
        enqueue('done', {
          text: finalText,
          usage,
          finishReason,
          validation,
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
